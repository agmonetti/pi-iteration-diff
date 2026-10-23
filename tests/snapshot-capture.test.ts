import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, rm, symlink, link } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { captureSnapshot, workspaceRoot } from "../src/snapshots/capture.js";
import { compareSnapshots } from "../src/snapshots/model.js";
import { workspace } from "./fixtures/workspace.js";

const exec = promisify(execFile);

test("capture two net iterations with dirty/staged files, shell edits and intact Git", async () => {
  const w = await workspace();
  try {
    await w.write("dirty.txt", "committed");
    await w.write("deleted.txt", "delete me");
    await w.git("add", "--", "dirty.txt", "deleted.txt");
    await w.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture");
    await w.write("dirty.txt", "staged user edit");
    await w.git("add", "--", "dirty.txt");
    await w.write("dirty.txt", "unstaged user edit");
    await w.write("preexisting.txt", "untracked user edit");
    const index = await readFile(join(w.root, ".git/index"));
    const head = await w.git("rev-parse", "HEAD");
    const before = await captureSnapshot(w.root);
    assert.deepEqual(before.issues, []);
    assert.equal(await workspaceRoot(w.root), w.root);
    await exec("bash", ["-c", "printf intermediate > dirty.txt; printf final > dirty.txt; printf new > 'new 😀.txt'; rm deleted.txt"], { cwd: w.root });
    const after = await captureSnapshot(w.root);
    const delta = compareSnapshots(before, after);
    assert.equal(delta.status, "complete");
    assert.deepEqual(delta.changes.map(c => [c.path, c.kind]), [["deleted.txt", "deleted"], ["dirty.txt", "modified"], ["new 😀.txt", "created"]]);
    assert.equal(delta.changes[1].before?.toString(), "unstaged user edit");
    const secondBefore = await captureSnapshot(w.root);
    await w.write("second.txt", "second run");
    assert.deepEqual(compareSnapshots(secondBefore, await captureSnapshot(w.root)).changes.map(c => c.path), ["second.txt"]);
    await w.write("second.txt", "intermediate");
    await w.write("second.txt", "second run");
    assert.equal(compareSnapshots(await captureSnapshot(w.root), await captureSnapshot(w.root)).changes.length, 0);
    assert.deepEqual(await readFile(join(w.root, ".git/index")), index);
    assert.deepEqual(await w.git("rev-parse", "HEAD"), head);
  } finally { await w.close(); }
});

test("filters ignored (even tracked), secrets, binary, links, subtrees and external paths", async () => {
  const w = await workspace();
  const external = await workspace();
  try {
    await w.write("ignored.txt", "ignored");
    await w.git("add", "--", "ignored.txt");
    await w.write(".gitignore", "ignored.txt\nuntracked-ignored.txt\n");
    await w.write("untracked-ignored.txt", "ignored");
    for (const path of [".env", ".envrc", ".environment", ".env-local"]) await w.write(path, "fixture secret");
    await w.write("key.pem", "fixture");
    await w.write("tokens.txt", "api_key=synthetic-private-fixture");
    await w.write("nul.bin", Buffer.from([0, 1]));
    await w.write("utf8.bin", Buffer.from([255]));
    await w.write("text.txt", "é\r\n😀\t");
    await w.write("custom.txt", "excluded");
    await external.write("outside.txt", "must not capture");
    await symlink(join(external.root, "outside.txt"), join(w.root, "symbol.txt"));
    await symlink(external.root, join(w.root, "external"));
    await link(join(external.root, "outside.txt"), join(w.root, "hard.txt"));
    const capture = await captureSnapshot(w.root, { exclude: ["custom.txt"] });
    assert.deepEqual([...capture.files.keys()].sort(), [".gitignore", "text.txt"]);
    assert.equal(capture.omitted.get("ignored.txt"), "policy");
    for (const path of [".env", ".envrc", ".environment", ".env-local"]) assert.equal(capture.omitted.get(path), "policy");
    assert.ok(!capture.files.has("external/outside.txt"));
    assert.equal(capture.files.get("text.txt")?.toString(), "é\r\n😀\t");
    assert.equal(compareSnapshots(capture, capture).status, "partial");
    await assert.rejects(captureSnapshot(w.root, { exclude: ["../outside"] }));
    await assert.rejects(captureSnapshot(w.root, { maxFiles: 0 }));
  } finally { await w.close(); await external.close(); }
});

test("limits and cancellation expose partial results without invented deletions", async () => {
  const w = await workspace();
  try {
    await w.write("a", "1234"); await w.write("b", "5678");
    await mkdir(join(w.root, "nested")); await w.write("nested/deep", "nested");
    const full = await captureSnapshot(w.root);
    for (const options of [{ maxFiles: 1 }, { maxFileBytes: 2 }, { maxBytes: 5 }, { maxEnumerationBytes: 1 }, { maxDepth: 1 }]) {
      const capture = await captureSnapshot(w.root, options);
      assert.equal(compareSnapshots(full, capture).status, "partial");
      assert.ok(!compareSnapshots(full, capture).changes.some(c => c.kind === "deleted"));
      assert.ok(capture.bytes <= (options.maxBytes ?? 16 * 1024 * 1024));
    }
    const aborted = await captureSnapshot(w.root, {}, AbortSignal.abort());
    assert.equal(aborted.enumerationComplete, false);
    assert.equal(aborted.files.size, 0);
    assert.ok(aborted.issues.includes("capture-cancelled-or-timeout"));
    const timed = await captureSnapshot(w.root, { maxMs: 1 });
    assert.equal(timed.enumerationComplete, false);
    assert.ok(timed.issues.includes("capture-cancelled-or-timeout"));
  } finally { await w.close(); }
});

test("unreadable and special files are partial, and disappearing tracked files are absent", async () => {
  const w = await workspace();
  try {
    await w.write("private", "fixture");
    await w.write("pipe", "regular before run");
    await w.git("add", "--", "private", "pipe");
    const before = await captureSnapshot(w.root);
    await chmod(join(w.root, "private"), 0);
    if (process.getuid?.() !== 0) {
      const unavailable = await captureSnapshot(w.root);
      assert.equal(unavailable.omitted.get("private"), "file-unavailable");
      assert.equal(compareSnapshots(before, unavailable).status, "partial");
      assert.equal(compareSnapshots(before, unavailable).changes.length, 0);
    }
    await chmod(join(w.root, "private"), 0o600);
    await rm(join(w.root, "private"));
    await rm(join(w.root, "pipe"));
    await exec("mkfifo", [join(w.root, "pipe")]);
    const after = await captureSnapshot(w.root);
    assert.equal(after.omitted.get("pipe"), "unsupported-file-type");
    assert.deepEqual(compareSnapshots(before, after).changes.map(c => [c.path, c.kind]), [["private", "deleted"]]);
  } finally { await w.close(); }
});

test("bounded capture measurement: 512 files / 2 MiB", async () => {
  const w = await workspace();
  try {
    for (let i = 0; i < 512; i++) await w.write(`file-${i}`, "x".repeat(4096));
    const start = performance.now();
    const snapshot = await captureSnapshot(w.root, { maxMs: 10_000 });
    const elapsed = performance.now() - start;
    assert.deepEqual(snapshot.issues, []);
    assert.equal(snapshot.files.size, 512);
    assert.equal(snapshot.bytes, 2 * 1024 * 1024);
    console.log(`M1 measurement: 512 files, ${snapshot.bytes} retained bytes, ${elapsed.toFixed(1)} ms; RSS ${process.memoryUsage().rss} bytes (whole test process, not capture allocation)`);
  } finally { await w.close(); }
});

test("changing ignore and exclusion policies never invents creation or deletion", async () => {
  const w = await workspace();
  try {
    await mkdir(join(w.root, "ignored"));
    await w.write("ignored/existing", "preexisting");
    await w.write(".gitignore", "ignored/\n");
    const before = await captureSnapshot(w.root);
    await w.write(".gitignore", "");
    const after = await captureSnapshot(w.root);
    assert.ok(!compareSnapshots(before, after).changes.some(c => c.path === "ignored/existing"));
    assert.ok(!compareSnapshots(after, before).changes.some(c => c.path === "ignored/existing"));
    assert.equal(compareSnapshots(before, after).status, "partial");
    const excluded = await captureSnapshot(w.root, { exclude: ["ignored"] });
    assert.ok(!compareSnapshots(excluded, after).changes.some(c => c.path === "ignored/existing"));
  } finally { await w.close(); }
});

test("linked worktree scope excludes sibling worktree and submodule contents", async () => {
  const w = await workspace();
  const parent = await workspace();
  const linked = join(parent.root, "linked");
  try {
    await w.write("base", "base"); await w.git("add", "--", "base");
    await w.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture");
    await w.git("worktree", "add", "-q", "-b", "fixture-linked", linked);
    await w.write("sibling", "not in linked");
    await mkdir(join(linked, "sub"));
    await exec("git", ["-C", linked, "update-index", "--add", "--cacheinfo", `160000,${(await w.git("rev-parse", "HEAD")).toString().trim()},sub`]);
    await exec("bash", ["-c", "printf hidden > sub/hidden"], { cwd: linked });
    const snapshot = await captureSnapshot(linked);
    assert.equal(await workspaceRoot(linked), linked);
    assert.deepEqual([...snapshot.files.keys()], ["base"]);
    assert.equal(snapshot.omitted.get("sub"), "unsupported-file-type");
  } finally {
    await w.git("worktree", "remove", "--force", linked).catch(() => undefined);
    await w.close(); await parent.close();
  }
});
