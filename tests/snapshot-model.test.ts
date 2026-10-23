import assert from "node:assert/strict";
import { test } from "node:test";
import { compareSnapshots, type Snapshot } from "../src/snapshots/model.js";

function snapshot(contents: Record<string, string>, extra: Partial<Snapshot> = {}): Snapshot {
  return { root: "/fixture", startedAt: 0, finishedAt: 1, files: new Map(Object.entries(contents).map(([p, s]) => [p, Buffer.from(s)])),
    omitted: new Map(), enumerationComplete: true, issues: [], bytes: 0, ...extra };
}

test("net byte comparison preserves preexisting content and ignores intermediate edits", () => {
  const before = snapshot({ dirty: "user edit", same: "A", modified: "before", deleted: "old" });
  const after = snapshot({ dirty: "user edit", same: "A", modified: "after\r\n😀", created: "new" });
  const delta = compareSnapshots(before, after);
  assert.equal(delta.status, "complete");
  assert.deepEqual(delta.changes.map(c => [c.path, c.kind]), [["created", "created"], ["deleted", "deleted"], ["modified", "modified"]]);
  assert.equal(compareSnapshots(before, before).changes.length, 0);
  assert.equal(delta.changes[2].before?.toString(), "before");
});

test("partial enumeration and per-path omissions never invent absence", () => {
  const full = snapshot({ known: "old", missing: "old" });
  const partial = snapshot({ known: "next", new: "next" }, { enumerationComplete: false, issues: ["limit"] });
  assert.deepEqual(compareSnapshots(full, partial).changes.map(c => c.path), ["known", "new"]);
  assert.deepEqual(compareSnapshots(partial, full).changes.map(c => c.path), ["known", "new"]);
  const omitted = snapshot({}, { omitted: new Map([["known", "binary"], ["missing", "size"]]), issues: ["omitted"] });
  assert.deepEqual(compareSnapshots(full, omitted).changes, []);
  assert.equal(compareSnapshots(full, omitted).status, "partial");
  assert.throws(() => compareSnapshots(full, snapshot({}, { root: "/other" })));
});
