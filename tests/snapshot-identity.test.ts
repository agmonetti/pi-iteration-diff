import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { mock, test } from "node:test";
import { captureSnapshot } from "../src/snapshots/capture.js";
import { compareSnapshots } from "../src/snapshots/model.js";
import { workspace } from "./fixtures/workspace.js";

test("unverifiable file identity is partial, never a deletion or readable content", async () => {
  const w = await workspace();
  let patch: ReturnType<typeof mock.method> | undefined;
  try {
    await w.write("ordinary", "baseline");
    const before = await captureSnapshot(w.root);
    const original = fs.lstat;
    patch = mock.method(fs, "lstat", async (...args: Parameters<typeof fs.lstat>) => {
      const stat = await original(...args);
      if (args[0] === join(w.root, "ordinary")) return Object.assign(stat, { ino: 0n });
      return stat;
    });
    syncBuiltinESMExports();
    const after = await captureSnapshot(w.root);
    assert.equal(after.omitted.get("ordinary"), "unverifiable-file-identity");
    assert.equal(after.files.size, 0);
    assert.equal(compareSnapshots(before, after).status, "partial");
    assert.deepEqual(compareSnapshots(before, after).changes, []);
  } finally {
    patch?.mock.restore(); syncBuiltinESMExports(); await w.close();
  }
});

test("cancellation during metadata prevents opening or publishing the file", async () => {
  const w = await workspace();
  let patch: ReturnType<typeof mock.method> | undefined;
  let opened: ReturnType<typeof mock.method> | undefined;
  try {
    await w.write("ordinary", "baseline");
    const cancellation = new AbortController();
    const original = fs.lstat;
    patch = mock.method(fs, "lstat", async (...args: Parameters<typeof fs.lstat>) => {
      const stat = await original(...args);
      if (args[0] === join(w.root, "ordinary")) cancellation.abort();
      return stat;
    });
    opened = mock.method(fs, "open");
    syncBuiltinESMExports();
    const snapshot = await captureSnapshot(w.root, {}, cancellation.signal);
    assert.equal(opened.mock.callCount(), 0);
    assert.equal(snapshot.files.size, 0);
    assert.ok(snapshot.issues.includes("capture-cancelled-or-timeout"));
  } finally {
    patch?.mock.restore(); opened?.mock.restore(); syncBuiltinESMExports(); await w.close();
  }
});

test("Linux descriptor containment remains mandatory before any content read", {
  skip: process.platform !== "linux" ? "Linux-only additional procfs guarantee" : false,
}, async () => {
  const w = await workspace();
  try {
    await w.write("ordinary", "baseline");
    for (const unavailable of [false, true]) {
      const originalRealpath = fs.realpath;
      const originalOpen = fs.open;
      let read: ReturnType<typeof mock.method> | undefined;
      let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
      const pathPatch = mock.method(fs, "realpath", async (...args: Parameters<typeof fs.realpath>) => {
        if (String(args[0]).startsWith("/proc/self/fd/")) {
          if (unavailable) throw Object.assign(new Error("procfs unavailable"), { code: "ENOENT" });
          return join(w.root, "different-file");
        }
        return originalRealpath(...args);
      });
      const openPatch = mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
        handle = await originalOpen(...args);
        read = mock.method(handle, "read");
        return handle;
      });
      syncBuiltinESMExports();
      try {
        const snapshot = await captureSnapshot(w.root);
        assert.equal(snapshot.files.size, 0);
        assert.ok(snapshot.omitted.has("ordinary"));
        assert.equal(read?.mock.callCount(), 0);
        assert.equal(handle?.fd, -1, "unsafe descriptor was closed");
      } finally {
        read?.mock.restore(); openPatch.mock.restore(); pathPatch.mock.restore(); syncBuiltinESMExports();
      }
    }
  } finally { await w.close(); }
});

test("inspection preserves native Git index, staging, history, status and config", async () => {
  const w = await workspace();
  try {
    await w.write("staged", "committed");
    await w.git("add", "--", "staged");
    await w.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture");
    await w.write("staged", "staged");
    await w.git("add", "--", "staged");
    await w.write("staged", "unstaged");
    await w.write("untracked", "untracked");
    const state = async (): Promise<Buffer[]> => Promise.all([
      fs.readFile(join(w.root, ".git", "index")), fs.readFile(join(w.root, ".git", "config")),
      w.git("status", "--porcelain=v1", "-z"), w.git("log", "--all", "--format=%H"),
      w.git("diff", "--cached", "--binary"), w.git("diff", "--binary"),
    ]);
    const before = await state();
    const first = await captureSnapshot(w.root);
    const second = await captureSnapshot(w.root);
    assert.equal(compareSnapshots(first, second).status, "complete");
    assert.deepEqual(compareSnapshots(first, second).changes, []);
    assert.deepEqual(await state(), before);
  } finally { await w.close(); }
});
