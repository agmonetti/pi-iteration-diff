import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { mock, test } from "node:test";
import { captureSnapshot, workspaceRoot } from "../src/snapshots/capture.js";
import { compareSnapshots } from "../src/snapshots/model.js";
import { workspace } from "./fixtures/workspace.js";

console.log(`M1 native portability: platform=${process.platform}; Node=${process.version}; WSL=${!!process.env.WSL_DISTRO_NAME}`);

test("native paths preserve Unicode, spaces, CRLF, case and literal POSIX backslashes", async () => {
  const w = await workspace();
  try {
    await fs.mkdir(join(w.root, "nested space-é"));
    const path = "nested space-é/café 😀.txt";
    await w.write(path, "before\r\n");
    await w.write("Case.txt", "upper");
    await w.git("add", "--", path, "Case.txt");
    const before = await captureSnapshot(w.root);
    assert.deepEqual(before.issues, []);
    assert.equal(await workspaceRoot(join(w.root, "nested space-é")), w.root);
    await w.write(path, "after\r\n");
    const upper = await fs.lstat(join(w.root, "Case.txt"), { bigint: true });
    await w.write("case.txt", "lower");
    const lower = await fs.lstat(join(w.root, "case.txt"), { bigint: true });
    const after = await captureSnapshot(w.root);
    assert.deepEqual(after.issues, []);
    assert.equal(after.files.get(path)?.toString(), "after\r\n");
    if (upper.ino === lower.ino) {
      assert.equal(after.files.get("Case.txt")?.toString(), "lower", "case-insensitive filesystem preserves Git spelling");
    } else {
      assert.equal(after.files.get("Case.txt")?.toString(), "upper");
      assert.equal(after.files.get("case.txt")?.toString(), "lower");
    }
    assert.equal(compareSnapshots(before, after).status, "complete");
    if (process.platform === "win32") {
      for (const prefix of ["C:\\outside", "nested\\file", "file:stream", "NUL.txt", "com1", "trailing.", "trailing ", ".GiT/config", "../outside"]) {
        await assert.rejects(captureSnapshot(w.root, { exclude: [prefix] }), /invalid-exclusion-prefix/);
      }
      await assert.rejects(captureSnapshot(w.root, { exclude: ["\\\\server\\share"] }));
    } else {
      await w.write("literal\\name", "POSIX filename");
      assert.equal((await captureSnapshot(w.root)).files.get("literal\\name")?.toString(), "POSIX filename");
    }
  } finally { await w.close(); }
});

test("enumeration ignores inherited Git overrides and disables repository fsmonitor", async () => {
  const w = await workspace();
  const other = await workspace();
  const previous = process.env.GIT_INDEX_FILE;
  try {
    await w.write("ordinary", "workspace");
    await other.write("outside", "other workspace");
    await other.git("add", "--", "outside");
    await w.git("config", "core.fsmonitor", "a-helper-that-must-not-run");
    await other.write("excludes", "excluded\n");
    await w.git("config", "core.excludesfile", join(other.root, "excludes"));
    await w.write("excluded", "must remain excluded");
    process.env.GIT_INDEX_FILE = join(other.root, ".git", "index");
    const snapshot = await captureSnapshot(w.root);
    assert.deepEqual(snapshot.issues, []);
    assert.deepEqual([...snapshot.files.keys()], ["ordinary"]);
    assert.equal(snapshot.omitted.get("excluded"), "policy");
  } finally {
    if (previous === undefined) delete process.env.GIT_INDEX_FILE; else process.env.GIT_INDEX_FILE = previous;
    await w.close(); await other.close();
  }
});

for (const race of ["parent-link", "leaf-replaced", "growth", "hardlink", "cancel-read"] as const) {
  test(`portable identity protocol rejects ${race} without publishing content`, async () => {
    const w = await workspace();
    const external = await workspace();
    let patch: ReturnType<typeof mock.method> | undefined;
    const reads: ReturnType<typeof mock.method>[] = [];
    const cancellation = new AbortController();
    try {
      await fs.mkdir(join(w.root, "dir"));
      await w.write("dir/file", "baseline");
      await external.write("file", "external");
      const before = await captureSnapshot(w.root);
      const originalOpen = fs.open;
      let readCount = 0;
      patch = mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
        if (race === "parent-link") {
          await fs.rename(join(w.root, "dir"), join(w.root, "saved"));
          await fs.symlink(external.root, join(w.root, "dir"), process.platform === "win32" ? "junction" : "dir");
        }
        const handle = await originalOpen(...args);
        if (race === "leaf-replaced") {
          await fs.rename(join(w.root, "dir/file"), join(w.root, "saved-file"));
          await w.write("dir/file", "baseline");
        }
        const originalRead = handle.read.bind(handle);
        reads.push(mock.method(handle, "read", async (...readArgs: Parameters<typeof handle.read>) => {
          readCount++;
          const result = await originalRead(...readArgs);
          if (readCount === 1) {
            if (race === "growth") await fs.appendFile(join(w.root, "dir/file"), "growth");
            if (race === "hardlink") await fs.link(join(w.root, "dir/file"), join(w.root, "alias"));
            if (race === "cancel-read") cancellation.abort();
          }
          return result;
        }));
        return handle;
      });
      syncBuiltinESMExports();
      const after = await captureSnapshot(w.root, {}, cancellation.signal);
      assert.ok(after.omitted.has("dir/file"));
      assert.equal(after.files.size, 0);
      assert.equal(compareSnapshots(before, after).status, "partial");
      assert.deepEqual(compareSnapshots(before, after).changes, []);
      if (race === "parent-link" || race === "leaf-replaced") assert.equal(readCount, 0, "race rejected before reading bytes");
    } finally {
      for (const read of reads) read.mock.restore();
      patch?.mock.restore(); syncBuiltinESMExports();
      await w.close(); await external.close();
    }
  });
}

for (const stop of ["abort", "timeout", "stdout-cap"] as const) {
  test(`native subprocess ${stop} waits for exit and leaves no running child`, { timeout: 10000 }, async () => {
    const w = await workspace();
    let patch: ReturnType<typeof mock.method> | undefined;
    let child: ReturnType<typeof childProcess.spawn> | undefined;
    const cancellation = new AbortController();
    try {
      const originalSpawn = childProcess.spawn;
      patch = mock.method(childProcess, "spawn", () => {
        child = originalSpawn(process.execPath, ["-e", stop === "stdout-cap" ? "process.stdout.write('x'.repeat(32768)); setInterval(()=>{},1000)" : "setInterval(()=>{},1000)"], { stdio: ["ignore", "pipe", "ignore"] });
        if (stop === "abort") child.once("spawn", () => cancellation.abort());
        return child;
      });
      syncBuiltinESMExports();
      const snapshot = await captureSnapshot(w.root, { maxMs: stop === "timeout" ? 250 : 5000 }, cancellation.signal);
      assert.ok(child?.pid);
      assert.ok(child.exitCode !== null || child.signalCode !== null, "capture awaits the child's close event");
      assert.throws(() => process.kill(child!.pid!, 0), { code: "ESRCH" });
      assert.equal(snapshot.enumerationComplete, false);
      assert.equal(snapshot.files.size, 0);
      assert.ok(snapshot.issues.includes(stop === "stdout-cap" ? "enumeration-limit" : "capture-cancelled-or-timeout"));
    } finally {
      child?.kill("SIGKILL");
      patch?.mock.restore(); syncBuiltinESMExports();
      await w.close();
    }
  });
}
