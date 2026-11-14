import assert from "node:assert/strict";
import { test } from "node:test";
import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import type { DiffFile, DiffRow, IterationView } from "../src/diffs/iteration-diff.js";
import { DiffPanel } from "../src/ui/diff-panel.js";

type CopyResult = boolean | string | void | Promise<boolean | string | void>;

function diffFile(path: string, rows: DiffRow[], calls?: { count: number }): DiffFile {
  return {
    path, kind: "modified", added: 1, removed: 1,
    getRows() { if (calls) calls.count++; return rows; },
  };
}

function view(files: readonly DiffFile[]): IterationView {
  return { key: "iteration-copy", title: "DIFF: última iteración", notices: [], files };
}

interface Harness {
  panel: DiffPanel;
  copies: string[];
  notices: Array<{ message: string; type: "info" | "warning" }>;
  drafts: string[];
  editorCalls: () => number;
  closeCalls: () => number;
}

function harness(result?: (text: string) => CopyResult, withCopy = true): Harness {
  const copies: string[] = [];
  const notices: Array<{ message: string; type: "info" | "warning" }> = [];
  const drafts: string[] = [];
  let editorCalls = 0;
  let closeCalls = 0;
  const panel = new DiffPanel({
    render() {}, editor() { editorCalls++; }, close() { closeCalls++; },
    style: (_role, text) => text,
    appendContext(snippet) { drafts.push(snippet); },
    ...(withCopy ? { copyText(text: string) { copies.push(text); return result ? result(text) : true; } } : {}),
    notify(message, type) { notices.push({ message, type }); },
  });
  return { panel, copies, notices, drafts, editorCalls: () => editorCalls, closeCalls: () => closeCalls };
}

const sampleRows: DiffRow[] = [
  { kind: "hunk", text: "@@ -1,2 +1,3 @@" },
  { kind: "context", oldLine: 1, newLine: 1, text: "const a = 1;" },
  { kind: "removed", oldLine: 2, text: "const b = 2;" },
  { kind: "added", newLine: 2, text: "const b = 3;" },
  { kind: "added", newLine: 3, text: "const c = 4;" },
];

function selectedRange(panel: DiffPanel): void {
  panel.handleInput("\r"); // expand file header
  panel.handleInput("\x1b[B"); // hunk
  panel.handleInput("\x1b[B"); // context
  panel.handleInput("\x1b[B"); // removed
  panel.handleInput("\x1b[1;2B"); // select added
  panel.handleInput("\x1b[1;2B"); // select second added
}

test("c copies exactly the selection payload without touching draft, focus, dock, or selection", () => {
  const h = harness();
  h.panel.setView(view([diffFile("src/a.ts", sampleRows)]));
  selectedRange(h.panel);
  const expected = h.panel.formatSelectedContext();
  assert.ok(expected);

  h.panel.handleInput("c");

  assert.equal(h.copies.length, 1);
  assert.equal(h.copies[0], expected, "c uses the same payload as a");
  assert.ok(!h.copies[0]!.includes("\x1b"), "payload has no ANSI styling");
  assert.ok(expected.includes("-const b = 2;"));
  assert.ok(expected.includes("+const b = 3;"));
  assert.ok(expected.includes("+const c = 4;"));
  assert.ok(!expected.includes("const a = 1;"), "unselected context is not copied");
  assert.equal(h.panel.hasSelection(), true, "selection is preserved");
  assert.equal(h.panel.formatSelectedContext(), expected);
  assert.equal(h.editorCalls(), 0, "focus does not move to the editor");
  assert.equal(h.closeCalls(), 0, "dock stays open");
  assert.deepEqual(h.drafts, [], "the editor draft is untouched");
  assert.deepEqual(h.notices.at(-1), { message: "Copied 3 lines from src/a.ts", type: "info" });

  h.panel.handleInput("a");
  assert.equal(h.drafts[0], expected, "a and c carry byte-identical payloads");
});

test("c without a selection copies the cursor row; non-diff rows show a hint", () => {
  const h = harness();
  h.panel.setView(view([diffFile("src/a.ts", sampleRows)]));

  // File header: no diff text under the cursor.
  h.panel.handleInput("c");
  assert.equal(h.copies.length, 0);
  assert.deepEqual(h.notices.at(-1), { message: "Select a diff line or range first", type: "warning" });

  h.panel.handleInput("\r"); // expand
  h.panel.handleInput("\x1b[B"); // hunk header
  h.panel.handleInput("c");
  assert.equal(h.copies.length, 1);
  assert.equal(h.copies[0], "[src/a.ts | diff]\n@@ -1,2 +1,3 @@");
  assert.deepEqual(h.notices.at(-1), { message: "Copied hunk header from src/a.ts", type: "info" });
  assert.equal(h.panel.hasSelection(), false, "copying never creates a selection");

  h.panel.handleInput("\x1b[B"); // context row
  h.panel.handleInput("c");
  assert.equal(h.copies.length, 2);
  assert.ok(h.copies[1]!.includes(" const a = 1;"));
  assert.ok(!h.copies[1]!.includes("const b = 2;"));
  assert.deepEqual(h.notices.at(-1), { message: "Copied 1 line from src/a.ts", type: "info" });
  assert.equal(h.panel.hasSelection(), false);
});

test("C copies every file and hunk regardless of collapsed state or viewport", () => {
  const callsA = { count: 0 };
  const callsB = { count: 0 };
  const rowsA: DiffRow[] = [
    { kind: "hunk", text: "@@ -1,2 +1,2 @@" },
    { kind: "context", oldLine: 1, newLine: 1, text: "const a = 1;" },
    { kind: "removed", oldLine: 2, text: "const b = 2;" },
    { kind: "added", newLine: 2, text: "const b = 3;" },
    { kind: "hunk", text: "@@ -7,1 +7,2 @@" },
    { kind: "context", oldLine: 7, newLine: 7, text: "export function f() {" },
    { kind: "added", newLine: 8, text: "  return 1;" },
    { kind: "notice", text: "\\ Sin salto de línea al final del archivo" },
  ];
  const rowsB: DiffRow[] = [
    { kind: "hunk", text: "@@ -1 +1 @@" },
    { kind: "added", newLine: 1, text: "hello" },
  ];
  const h = harness();
  h.panel.setView(view([diffFile("src/a.ts", rowsA, callsA), diffFile("src/b.ts", rowsB, callsB)]));

  h.panel.handleInput("C");

  assert.equal(h.copies.length, 1);
  const copied = h.copies[0]!;
  assert.ok(copied.includes("[src/a.ts | diff | old:1-7 | new:1-8]"));
  assert.ok(copied.includes("[src/b.ts | diff | new:1]"));
  assert.ok(copied.indexOf("src/a.ts") < copied.indexOf("src/b.ts"), "file order follows the panel");
  assert.ok(copied.includes("@@ -1,2 +1,2 @@"));
  assert.ok(copied.includes("@@ -7,1 +7,2 @@"), "all hunks of a file are included");
  assert.ok(copied.includes(" export function f() {"));
  assert.ok(copied.includes("+  return 1;"));
  assert.ok(copied.includes("+hello"));
  assert.ok(!copied.includes("Sin salto de línea"), "meta notices are not diff lines");
  assert.ok(!copied.includes("\x1b"));
  assert.equal(callsA.count, 1);
  assert.equal(callsB.count, 1);
  assert.deepEqual(h.notices.at(-1), { message: "Copied whole diff: 6 lines from 2 files", type: "info" });

  const rendered = h.panel.render(120).map(stripTerminalSequences).join("\n");
  assert.ok(rendered.includes("▸ M a.ts"));
  assert.ok(rendered.includes("▸ M b.ts"));
  assert.ok(!rendered.includes("@@"), "copying does not expand or collapse the view");
});

test("multi-hunk selections keep every hunk header in panel order", () => {
  const rows: DiffRow[] = [
    { kind: "hunk", text: "@@ -1 +1 @@" },
    { kind: "added", newLine: 1, text: "first" },
    { kind: "hunk", text: "@@ -9 +9 @@" },
    { kind: "added", newLine: 9, text: "second" },
  ];
  const h = harness();
  h.panel.setView(view([diffFile("src/a.ts", rows)]));
  h.panel.handleInput("\r");
  h.panel.handleInput("\x1b[B"); // first hunk
  for (let i = 0; i < 4; i++) h.panel.handleInput("\x1b[1;2B"); // through the second added row

  h.panel.handleInput("c");

  assert.equal(h.copies.length, 1);
  assert.ok(h.copies[0]!.includes("@@ -1 +1 @@"));
  assert.ok(h.copies[0]!.includes("@@ -9 +9 @@"));
  assert.ok(h.copies[0]!.includes("+first"));
  assert.ok(h.copies[0]!.includes("+second"));
});

test("cross-file selections copy both file blocks and C preserves the selection", () => {
  const h = harness();
  const rowsA: DiffRow[] = [
    { kind: "hunk", text: "@@ -1 +1 @@" },
    { kind: "added", newLine: 1, text: "from-a" },
  ];
  const rowsB: DiffRow[] = [
    { kind: "hunk", text: "@@ -1 +1 @@" },
    { kind: "added", newLine: 1, text: "from-b" },
  ];
  h.panel.setView(view([diffFile("src/a.ts", rowsA), diffFile("src/b.ts", rowsB)]));
  h.panel.handleInput("\r"); // expand A
  h.panel.handleInput("]"); // B header
  h.panel.handleInput("\r"); // expand B
  h.panel.render(100);
  // Mouse range from A's added row (display row 3) through B's added row (row 7).
  const mouse = (type: "press" | "drag" | "release", y: number) => ({
    type, button: "left" as const, x: 10, y, screenX: 10, screenY: y, width: 100, height: 24,
    shift: false, alt: false, ctrl: false,
  });
  h.panel.handleMouse(mouse("press", 6));
  h.panel.handleMouse(mouse("drag", 10));
  h.panel.handleMouse(mouse("release", 10));

  const selected = h.panel.formatSelectedContext();
  assert.ok(selected?.includes("[src/a.ts |"));
  assert.ok(selected?.includes("[src/b.ts |"));

  h.panel.handleInput("c");
  assert.equal(h.copies.at(-1), selected);
  assert.deepEqual(h.notices.at(-1), { message: "Copied 2 lines from 2 files", type: "info" });

  h.panel.handleInput("C");
  assert.equal(h.panel.hasSelection(), true, "whole-diff copy preserves the selection");
  assert.equal(h.panel.formatSelectedContext(), selected);
});

test("C refuses a whole diff over the export row bound instead of building it", () => {
  const rows: DiffRow[] = Array.from({ length: 100_001 }, (_, index) => ({
    kind: "added" as const, newLine: index + 1, text: "x",
  }));
  const h = harness();
  h.panel.setView(view([diffFile("src/huge.ts", rows)]));
  h.panel.handleInput("C");
  assert.equal(h.copies.length, 0);
  assert.equal(h.panel.formatWholeDiff(), undefined);
  assert.deepEqual(h.notices.at(-1), { message: "Whole diff is too large to copy", type: "warning" });
});

test("rejected, failed, and missing clipboards warn without throwing and leave the panel usable", async () => {
  const cases: Array<{ result: (text: string) => CopyResult; warning: RegExp }> = [
    { result: () => { throw new Error("sync denied"); }, warning: /sync denied/ },
    { result: () => Promise.reject(new Error("async denied")), warning: /async denied/ },
    { result: () => false, warning: /Clipboard unavailable/ },
  ];
  for (const item of cases) {
    const h = harness(item.result);
    h.panel.setView(view([diffFile("src/a.ts", sampleRows)]));
    h.panel.handleInput("\r");
    h.panel.handleInput("\x1b[B");
    h.panel.handleInput("\x1b[B");

    assert.doesNotThrow(() => h.panel.handleInput("c"));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.notices.at(-1)?.type, "warning");
    assert.match(h.notices.at(-1)?.message ?? "", item.warning);
    assert.ok(h.panel.render(120).length > 0, "panel remains renderable");
    h.panel.handleInput("d");
    assert.ok(h.panel.render(120).length > 0, "panel remains interactive");
  }

  const missing = harness(undefined, false);
  missing.panel.setView(view([diffFile("src/a.ts", sampleRows)]));
  missing.panel.handleInput("\r");
  missing.panel.handleInput("\x1b[B");
  missing.panel.handleInput("\x1b[B");
  missing.panel.handleInput("c");
  assert.deepEqual(missing.notices.at(-1), {
    message: "Clipboard unavailable in this environment", type: "warning",
  });
});

test("C with only unavailable notice rows warns instead of copying a fake diff", () => {
  const h = harness();
  h.panel.setView(view([diffFile("src/binary.dat", [{ kind: "notice", text: "Diff no disponible: archivo binario." }])]));
  h.panel.handleInput("C");
  assert.equal(h.copies.length, 0);
  assert.deepEqual(h.notices.at(-1), { message: "No diff content to copy", type: "warning" });
});

test("footer copy hints are width-gated and never widen an existing hint past the dock", () => {
  const h = harness();
  h.panel.setView(view([diffFile("src/a.ts", sampleRows)]));
  let footer = stripTerminalSequences(h.panel.render(120).at(-1)!);
  assert.ok(footer.includes("c: copy"));
  assert.ok(footer.includes("C: copy diff"));

  footer = stripTerminalSequences(h.panel.render(60).at(-1)!);
  assert.ok(!footer.includes("c: copy"), "narrow idle footer omits the optional hint");
  assert.ok(visibleWidth(footer) <= 60);

  h.panel.handleInput("\r");
  h.panel.handleInput("\x1b[B");
  h.panel.handleInput("\x1b[B");
  h.panel.handleInput("\x1b[B");
  h.panel.handleInput("\x1b[1;2B");
  footer = stripTerminalSequences(h.panel.render(120).at(-1)!);
  assert.ok(footer.includes("c: copy"));
  assert.ok(footer.includes("C: copy diff"));

  for (const line of h.panel.render(34)) assert.ok(visibleWidth(line) <= 34);
});
