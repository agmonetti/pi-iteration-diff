import assert from "node:assert/strict";
import { test } from "node:test";
import { createIterationView, iterationDiffLimits, type DiffFile } from "../src/diffs/iteration-diff.js";
import type { CapturedWindow } from "../src/lifecycle/iteration-capture.js";
import { compareSnapshots, type FileDelta, type Snapshot } from "../src/snapshots/model.js";

function snapshot(contents: Record<string, string | Buffer>, extra: Partial<Snapshot> = {}): Snapshot {
  return { root: "/fixture", startedAt: 0, finishedAt: 1,
    files: new Map(Object.entries(contents).map(([path, content]) => [path, Buffer.isBuffer(content) ? content : Buffer.from(content)])),
    omitted: new Map(), enumerationComplete: true, issues: [], bytes: 0, ...extra };
}

function captured(before = snapshot({}), after = snapshot({}), extra: Partial<CapturedWindow> = {}): CapturedWindow {
  return { id: { sessionId: "session", root: "/fixture", runtimeEpoch: "epoch", sequence: 1 },
    attribution: "individual", status: "complete", inputCount: 1, before, after, delta: compareSnapshots(before, after), ...extra };
}

function fileDiff(before: string | Buffer | undefined, after: string | Buffer | undefined): DiffFile {
  const view = createIterationView({ state: "individual", window: captured(
    snapshot(before === undefined ? {} : { file: before }), snapshot(after === undefined ? {} : { file: after })) });
  assert.equal(view.files.length, 1);
  return view.files[0];
}

function assertUnavailable(file: DiffFile, pattern: RegExp): void {
  assert.equal(file.added, undefined);
  assert.equal(file.removed, undefined);
  assert.match(file.notice ?? "", pattern);
  assert.deepEqual(file.getRows(), [{ kind: "notice", text: file.notice }]);
  assert.equal(file.getRows(), file.getRows());
}

test("real replacements expose exact old/new numbers, context, statistics and cached lazy rows", () => {
  const file = fileDiff("alpha\nold\nomega\n", "alpha\nnew\nomega\n");
  assert.equal(file.kind, "modified");
  assert.equal(file.added, 1);
  assert.equal(file.removed, 1);
  assert.equal(file.notice, undefined);
  assert.deepEqual(file.getRows(), [
    { kind: "hunk", text: "@@ -1,3 +1,3 @@" },
    { kind: "context", text: "alpha", oldLine: 1, newLine: 1 },
    { kind: "removed", text: "old", oldLine: 2 },
    { kind: "added", text: "new", newLine: 2 },
    { kind: "context", text: "omega", oldLine: 3, newLine: 3 },
  ]);
  assert.equal(file.getRows(), file.getRows());
});

test("creation/deletion use zero-line hunk ranges, including empty files", () => {
  assert.deepEqual(fileDiff(undefined, "new\n").getRows(), [
    { kind: "hunk", text: "@@ -0,0 +1,1 @@" }, { kind: "added", text: "new", newLine: 1 },
  ]);
  assert.deepEqual(fileDiff("old\n", undefined).getRows(), [
    { kind: "hunk", text: "@@ -1,1 +0,0 @@" }, { kind: "removed", text: "old", oldLine: 1 },
  ]);
  for (const [before, after, kind] of [[undefined, "", "created"], ["", undefined, "deleted"]] as const) {
    const file = fileDiff(before, after);
    assert.equal(file.kind, kind);
    assert.equal(file.added, 0);
    assert.equal(file.removed, 0);
    assert.deepEqual(file.getRows(), []);
  }
});

test("hunks retain three context lines, split far changes and merge adjacent context", () => {
  const old = Array.from({ length: 24 }, (_, i) => `line ${i + 1}`);
  const next = [...old];
  next[4] = "change five";
  next[19] = "change twenty";
  const rows = fileDiff(`${old.join("\n")}\n`, `${next.join("\n")}\n`).getRows();
  assert.deepEqual(rows.filter(row => row.kind === "hunk").map(row => row.text), ["@@ -2,7 +2,7 @@", "@@ -17,7 +17,7 @@"]);
  assert.equal(rows.find(row => row.kind === "removed")?.oldLine, 5);
  assert.equal(rows.findLast(row => row.kind === "added")?.newLine, 20);
  next[19] = old[19];
  next[11] = "change twelve";
  assert.equal(fileDiff(`${old.join("\n")}\n`, `${next.join("\n")}\n`).getRows().filter(row => row.kind === "hunk").length, 1);
});

test("CRLF, BOM, final LF and control bytes retain their byte-level text meaning", () => {
  const crlf = fileDiff("same\r\n", "same\n");
  assert.equal(crlf.added, 1);
  assert.equal(crlf.removed, 1);
  assert.equal(crlf.getRows().find(row => row.kind === "removed")?.text, "same\r");
  const eof = fileDiff("same", "same\n");
  assert.deepEqual(eof.getRows(), [
    { kind: "hunk", text: "@@ -1,1 +1,1 @@" },
    { kind: "removed", text: "same", oldLine: 1 },
    { kind: "notice", text: "\\ Sin salto de línea al final del archivo" },
    { kind: "added", text: "same", newLine: 1 },
  ]);
  const contextEof = fileDiff("old\ntail", "new\ntail").getRows();
  assert.deepEqual(contextEof.slice(-2), [
    { kind: "context", text: "tail", oldLine: 2, newLine: 2 },
    { kind: "notice", text: "\\ Sin salto de línea al final del archivo" },
  ]);
  assert.equal(fileDiff("\uFEFFtext\n", "text\n").getRows().find(row => row.kind === "removed")?.text, "\uFEFFtext");
  assert.equal(fileDiff(undefined, "\x1b[31m\ttext\n").getRows()[1].text, "\x1b[31m\ttext");
  assert.equal(fileDiff(undefined, "😀\n").getRows()[1].text, "😀");
});

test("small repeated-line cases reconstruct both endpoints and have minimal edit counts", () => {
  const sequences: string[][] = [[]];
  for (let length = 1; length <= 3; length++) {
    for (let bits = 0; bits < 2 ** length; bits++) sequences.push(Array.from({ length }, (_, i) => bits & (1 << i) ? "a" : "b"));
  }
  for (const old of sequences) for (const next of sequences) {
    const before = old.map(line => `${line}\n`).join("");
    const after = next.map(line => `${line}\n`).join("");
    if (before === after) continue;
    const file = fileDiff(before, after);
    const rows = file.getRows();
    assert.equal(rows.filter(row => row.oldLine !== undefined).map(row => `${row.text}\n`).join(""), before);
    assert.equal(rows.filter(row => row.newLine !== undefined).map(row => `${row.text}\n`).join(""), after);
    assert.deepEqual(rows.filter(row => row.oldLine !== undefined).map(row => row.oldLine), old.map((_, i) => i + 1));
    assert.deepEqual(rows.filter(row => row.newLine !== undefined).map(row => row.newLine), next.map((_, i) => i + 1));
    let longest = 0;
    for (let mask = 0; mask < 2 ** old.length; mask++) {
      const candidate = old.filter((_, i) => mask & (1 << i));
      let matched = 0;
      for (const line of next) if (line === candidate[matched]) matched++;
      if (matched === candidate.length) longest = Math.max(longest, matched);
    }
    assert.equal(file.added, next.length - longest);
    assert.equal(file.removed, old.length - longest);
  }
});

test("binary, invalid UTF-8 and missing endpoint contents never invent statistics", () => {
  assertUnavailable(fileDiff(undefined, Buffer.from([0, 65])), /binario/);
  assertUnavailable(fileDiff(Buffer.from([0xc3, 0x28]), "valid"), /UTF-8/);
  assertUnavailable(fileDiff(undefined, Buffer.from([0xc0, 0xaf])), /UTF-8/);
  const missing: FileDelta = { path: "missing", kind: "modified", before: Buffer.from("old") };
  const window = captured(undefined, undefined, { delta: { status: "partial", changes: [missing], issues: [] } });
  assertUnavailable(createIterationView({ state: "unavailable", reason: "partial", window }).files[0], /falta contenido/);
});

test("individual, grouped, partial, cancelled and failed windows preserve their actual status", () => {
  const before = snapshot({ file: "before" });
  const after = snapshot({ file: "after" });
  const individual = createIterationView({ state: "individual", window: captured(before, after) });
  assert.equal(individual.title, "Última iteración");
  assert.match(individual.notices.join(" "), /no demuestra autoría/);
  const grouped = createIterationView({ state: "unavailable", reason: "grouped-window",
    window: captured(before, after, { attribution: "grouped", inputCount: 3 }) });
  assert.match(grouped.title, /agrupada/);
  assert.doesNotMatch(grouped.title, /Última/);
  assert.match(grouped.notices.join(" "), /3 entradas/);
  assert.equal(grouped.files.length, 1);
  for (const status of ["partial", "cancelled", "failed"] as const) {
    const view = createIterationView({ state: "unavailable", reason: status, window: captured(before, after, { status }) });
    assert.equal(view.files.length, 1);
    assert.match(view.title, /no completo/);
    assert.match(view.notices.join(" "), status === "partial" ? /parcial/ : status === "cancelled" ? /cancelada/ : /falló/);
  }
  const unverified = createIterationView({ state: "unavailable", reason: "unverified", window: captured(before, after, { attribution: "unverified" }) });
  assert.match(unverified.title, /sin atribución/);
});

test("partial zero changes, omissions and capture issues cannot appear as a complete empty diff", () => {
  const before = snapshot({}, { omitted: new Map([["secret", "policy"]]), issues: ["file-size-limit"], enumerationComplete: false });
  const window = captured(before, snapshot({}), { status: "partial" });
  const partial = createIterationView({ state: "unavailable", reason: "partial", window });
  assert.equal(partial.files.length, 0);
  assert.match(partial.notices.join(" "), /no implica que la ventana esté vacía/);
  assert.match(partial.notices.join(" "), /file-size-limit/);
  assert.match(partial.notices.join(" "), /1 antes/);
  assert.doesNotMatch(partial.notices.join(" "), /Sin cambios netos observados/);
  assert.match(createIterationView({ state: "individual", window: captured() }).notices.join(" "), /Sin cambios netos observados/);
});

test("unavailable and capturing states do not leak stale files; identity covers every scope component", () => {
  const empty = createIterationView({ state: "unavailable", reason: "no-capture" });
  assert.equal(empty.files.length, 0);
  assert.match(empty.notices.join(" "), /No hay una captura/);
  const window = captured();
  const capturing = createIterationView({ state: "capturing", id: window.id });
  assert.equal(capturing.files.length, 0);
  assert.match(capturing.notices.join(" "), /curso/);
  const original = createIterationView({ state: "individual", window });
  assert.notEqual(capturing.key, original.key);
  for (const change of [{ sessionId: "other" }, { root: "/other" }, { runtimeEpoch: "next" }, { sequence: 2 }]) {
    assert.notEqual(createIterationView({ state: "individual", window: { ...window, id: { ...window.id, ...change } } }).key, original.key);
  }
});

test("file enumeration is capped without accessing omitted changes", () => {
  const changes: FileDelta[] = Array.from({ length: iterationDiffLimits.files }, (_, i) => ({ path: `file-${i}`, kind: "created", after: Buffer.from("new\n") }));
  changes.push({ get path(): string { throw new Error("must remain beyond cap"); }, kind: "created", after: Buffer.from("unused") });
  const window = captured(undefined, undefined, { delta: { status: "complete", changes, issues: [] } });
  const view = createIterationView({ state: "individual", window });
  assert.equal(view.files.length, iterationDiffLimits.files);
  assert.match(view.notices.join(" "), /64 de 65/);
});

test("byte and line bounds accept exact boundaries and explicitly reject excess", () => {
  assert.equal(fileDiff(undefined, "x".repeat(iterationDiffLimits.fileBytes)).added, 1);
  assertUnavailable(fileDiff(undefined, "x".repeat(iterationDiffLimits.fileBytes + 1)), /1 MiB/);
  const exact = fileDiff(undefined, "x\n".repeat(iterationDiffLimits.fileLines));
  assert.equal(exact.added, iterationDiffLimits.fileLines);
  assert.equal(exact.getRows().length, iterationDiffLimits.fileLines + 1);
  assertUnavailable(fileDiff(undefined, "x\n".repeat(iterationDiffLimits.fileLines + 1)), /12000 líneas/);
  for (const [content, pattern, count] of [["x".repeat(iterationDiffLimits.fileBytes), /2 MiB/, 2], ["x\n".repeat(iterationDiffLimits.fileLines), /16000 líneas/, 1]] as const) {
    const after = snapshot(Object.fromEntries(Array.from({ length: count + 1 }, (_, i) => [`f${i}`, content])));
    const view = createIterationView({ state: "individual", window: captured(snapshot({}), after) });
    assert.ok(view.files.slice(0, count).every(file => file.added !== undefined));
    assertUnavailable(view.files[count], pattern);
    assert.ok(view.files.reduce((total, file) => total + file.getRows().length, 0) <= iterationDiffLimits.rows);
  }
});

test("large file with four dispersed edits yields exact hunks and line numbers", () => {
  const old = Array.from({ length: 4391 }, (_, i) => `line ${i} ${"x".repeat(40)}\n`);
  const next = [...old];
  for (const i of [75, 455, 980, 1030]) next[i] = `replacement ${i}\n`;
  const file = fileDiff(old.join(""), next.join(""));
  assert.equal(file.added, 4);
  assert.equal(file.removed, 4);
  const rows = file.getRows();
  assert.equal(rows.filter(row => row.kind === "hunk").length, 4);
  assert.deepEqual(rows.filter(row => row.kind === "removed").map(row => row.oldLine), [76, 456, 981, 1031]);
  assert.deepEqual(rows.filter(row => row.kind === "added").map(row => row.newLine), [76, 456, 981, 1031]);
  assert.ok(rows.length < 50);
});

test("large dispersed insertions and deletions retain side and line identity", () => {
  const old = Array.from({ length: 1100 }, (_, i) => `unique-${i}\n`);
  const next = [...old];
  next.splice(850, 1);
  next.splice(100, 0, "inserted\n");
  const file = fileDiff(old.join(""), next.join(""));
  assert.equal(file.added, 1);
  assert.equal(file.removed, 1);
  const rows = file.getRows();
  assert.deepEqual(rows.filter(row => row.kind === "added").map(row => [row.newLine, row.text]), [[101, "inserted"]]);
  assert.deepEqual(rows.filter(row => row.kind === "removed").map(row => [row.oldLine, row.text]), [[851, "unique-850"]]);
});

test("bounded large-file comparison matches an independent LCS on repeated lines", () => {
  for (let seed = 0; seed < 8; seed++) {
    const old = Array.from({ length: 620 }, (_, i) => `value-${(i * 7 + seed) % 11}\n`);
    const next = [...old];
    next[1] = `start-${seed}\n`;
    next[618] = `end-${seed}\n`;
    next.splice(300, 0, `insert-${seed}\n`);
    const previous = new Uint16Array(next.length + 1);
    for (const line of old) {
      let diagonal = 0;
      for (let j = 1; j <= next.length; j++) {
        const above = previous[j];
        previous[j] = line === next[j - 1] ? diagonal + 1 : Math.max(previous[j], previous[j - 1]);
        diagonal = above;
      }
    }
    const file = fileDiff(old.join(""), next.join(""));
    assert.equal(file.removed, old.length - previous[next.length]);
    assert.equal(file.added, next.length - previous[next.length]);
    for (const row of file.getRows()) {
      if (row.oldLine !== undefined) assert.equal(`${row.text}\n`, old[row.oldLine - 1]);
      if (row.newLine !== undefined) assert.equal(`${row.text}\n`, next[row.newLine - 1]);
    }
  }
});

test("LCS work bounds reject difficult files and the aggregate comparison budget is enforced", () => {
  const old = Array.from({ length: 500 }, (_, i) => `old-${i}\n`).join("");
  const next = Array.from({ length: 500 }, (_, i) => `new-${i}\n`).join("");
  const accepted = fileDiff(old, next);
  assert.equal(accepted.added, 500);
  assert.equal(accepted.removed, 500);
  assert.equal(accepted.getRows().length, 1001);
  assertUnavailable(fileDiff(`${old}old-extra\n`, `${next}new-extra\n`), /250000/);
  const before = snapshot(Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`f${i}`, i === 4 ? "old\n" : old])));
  const after = snapshot(Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`f${i}`, i === 4 ? "new\n" : next])));
  const view = createIterationView({ state: "individual", window: captured(before, after) });
  assert.ok(view.files.slice(0, 4).every(file => file.added === 500));
  assertUnavailable(view.files[4], /1000000/);
  assert.match(view.notices.join(" "), /Límites del visor/);
});
