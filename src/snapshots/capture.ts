import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Snapshot } from "./model.js";

export interface CaptureLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxBytes: number;
  maxEnumerationBytes: number;
  maxDepth: number;
  maxMs: number;
  /** Literal relative path prefixes; no glob engine or filesystem discovery. */
  exclude: readonly string[];
}

export const defaultLimits: Readonly<CaptureLimits> = {
  maxFiles: 10_000, maxFileBytes: 1024 * 1024, maxBytes: 16 * 1024 * 1024,
  maxEnumerationBytes: 2 * 1024 * 1024, maxDepth: 32, maxMs: 2000, exclude: [],
};

/** Bounded, read-only Git subprocess; stderr and contents never enter diagnostics. */
async function git(root: string, args: string[], signal: AbortSignal, cap: number): Promise<Buffer> {
  return new Promise((fulfill, reject) => {
    const child = spawn("git", ["--no-optional-locks", "-C", root, ...args], {
      stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    });
    const chunks: Buffer[] = [];
    let size = 0;
    let failure: Error | undefined;
    const stop = (): void => { failure ??= new Error("capture-cancelled-or-timeout"); child.kill("SIGKILL"); };
    signal.addEventListener("abort", stop, { once: true });
    if (signal.aborted) stop();
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > cap) { failure = new Error("enumeration-limit"); child.kill("SIGKILL"); }
      else if (!failure) chunks.push(chunk);
    });
    child.on("error", () => { failure = new Error("git-unavailable"); });
    child.on("close", code => {
      signal.removeEventListener("abort", stop);
      if (failure || code !== 0) reject(failure ?? new Error("git-enumeration-failed"));
      else fulfill(Buffer.concat(chunks, size));
    });
  });
}

export async function workspaceRoot(cwd: string, signal: AbortSignal = AbortSignal.timeout(defaultLimits.maxMs)): Promise<string> {
  const root = await realpath((await git(cwd, ["rev-parse", "--show-toplevel"], signal, 16_384)).toString("utf8").trimEnd());
  if (root === sep || root === homedir()) throw new Error("unsafe-workspace-root");
  return root;
}

function validPath(path: string): boolean {
  return !!path && !isAbsolute(path) && !path.split("/").some(p => p === ".." || p === "." || p === "" || p === ".git");
}

function sensitivePath(path: string): boolean {
  return path.split("/").some(part => /^(?:\.env(?:\..*)?|\.ssh|\.gnupg|\.aws|\.azure|\.kube|\.npmrc|\.netrc|\.pypirc|credentials(?:\..*)?|secrets?(?:\..*)?|id_(?:rsa|ed25519|ecdsa)(?:\..*)?)$/i.test(part) || /\.(?:pem|key|p12|pfx|keystore)$/i.test(part));
}

function sensitiveContent(text: string): boolean {
  return /-----BEGIN (?:[A-Z ]*PRIVATE KEY|OPENSSH PRIVATE KEY)-----|(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[=:]\s*["']?[^\s"']{8,}/i.test(text);
}

export async function captureSnapshot(root: string, options: Partial<CaptureLimits> = {}, cancellation?: AbortSignal): Promise<Snapshot> {
  const limits = { ...defaultLimits, ...options };
  for (const [key, value] of Object.entries(limits)) {
    if (key !== "exclude" && (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)) throw new Error("invalid-capture-limit");
  }
  if (limits.exclude.length > limits.maxFiles || !limits.exclude.every(p => validPath(p)) ||
      limits.exclude.reduce((n, p) => n + Buffer.byteLength(p), 0) > limits.maxEnumerationBytes) throw new Error("invalid-exclusion-prefix");
  const startedAt = Date.now();
  const signal = AbortSignal.any([AbortSignal.timeout(limits.maxMs), ...(cancellation ? [cancellation] : [])]);
  const files = new Map<string, Buffer>();
  const omitted = new Map<string, string>(limits.exclude.map(p => [p, "policy"]));
  const issues = new Set<string>();
  let enumerationComplete = false;
  let bytes = 0;
  const check = (): void => { if (signal.aborted) throw new Error("capture-cancelled-or-timeout"); };
  try {
    check();
    if (root !== await realpath(root) || root === sep || root === homedir()) throw new Error("unsafe-workspace-root");
    // Require the worktree root, not a directory prefix that could include sibling projects.
    if (root !== await workspaceRoot(root, signal)) throw new Error("workspace-root-mismatch");
    check();
    const listing = await git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--deduplicate"], signal, limits.maxEnumerationBytes);
    const ignored = new Set(new TextDecoder("utf-8", { fatal: true }).decode(await git(root,
      ["ls-files", "-z", "--cached", "--others", "--ignored", "--exclude-standard", "--directory"], signal, limits.maxEnumerationBytes)).split("\0").filter(Boolean));
    if (ignored.size + limits.exclude.length > limits.maxFiles) throw new Error("exclusion-count-limit");
    for (const path of ignored) omitted.set(path, "policy");
    const paths = [...new Set(new TextDecoder("utf-8", { fatal: true }).decode(listing).split("\0").filter(Boolean))];
    enumerationComplete = paths.length <= limits.maxFiles;
    if (!enumerationComplete) issues.add("file-count-limit");
    for (const path of paths.slice(0, limits.maxFiles)) {
      check();
      let handle: Awaited<ReturnType<typeof open>> | undefined;
      try {
        if (!validPath(path)) throw new Error("unsupported-path");
        if (ignored.has(path) || sensitivePath(path) || limits.exclude.some(p => path === p || path.startsWith(`${p}/`))) {
          omitted.set(path, "policy"); continue;
        }
        const parts = path.split("/");
        if (parts.length > limits.maxDepth) throw new Error("depth-limit");
        for (let i = 1; i < parts.length; i++) {
          if (!(await lstat(join(root, ...parts.slice(0, i)))).isDirectory()) throw new Error("unsafe-parent");
        }
        const absolute = resolve(root, path);
        const metadata = await lstat(absolute);
        if (!metadata.isFile() || metadata.nlink > 1) throw new Error("unsupported-file-type");
        if (metadata.size > limits.maxFileBytes) throw new Error("file-size-limit");
        if (bytes + metadata.size > limits.maxBytes) throw new Error("memory-limit");
        check();
        handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        // Linux fd validation closes ancestor-symlink races before reading any content.
        if (process.platform !== "linux" || await realpath(`/proc/self/fd/${handle.fd}`) !== absolute || relative(root, absolute).startsWith(`..${sep}`)) throw new Error("unsafe-open-file");
        const before = await handle.stat();
        if (!before.isFile() || before.nlink > 1 || before.ino !== metadata.ino || before.dev !== metadata.dev || before.size !== metadata.size) throw new Error("file-raced");
        const buffer = Buffer.alloc(before.size + 1);
        let read = 0;
        while (read < buffer.length) {
          check();
          const result = await handle.read(buffer, read, buffer.length - read, read);
          if (!result.bytesRead) break;
          read += result.bytesRead;
        }
        const after = await handle.stat();
        check();
        if (read !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || await realpath(absolute) !== absolute) throw new Error("file-raced");
        const content = buffer.subarray(0, read);
        let text: string;
        try { text = new TextDecoder("utf-8", { fatal: true }).decode(content); }
        catch { throw new Error("binary-or-encoding"); }
        if (content.includes(0)) throw new Error("binary-or-encoding");
        if (sensitiveContent(text)) { omitted.set(path, "policy"); continue; }
        files.set(path, content);
        bytes += content.length;
      } catch (error) {
        if (!handle && (error as NodeJS.ErrnoException).code === "ENOENT") continue;
        const reason = error instanceof Error && !('code' in error) ? error.message : "file-unavailable";
        omitted.set(path, reason);
        issues.add(reason);
      } finally { await handle?.close(); }
    }
    check();
  } catch (error) {
    enumerationComplete = false;
    issues.add(error instanceof Error && !('code' in error) ? error.message : "capture-unavailable");
  }
  return { root, startedAt, finishedAt: Date.now(), files, omitted, enumerationComplete, issues: [...issues], bytes };
}
