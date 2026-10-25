import assert from "node:assert/strict";
import { test } from "node:test";
import { sliceByColumn, stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import type { DiffRow } from "../src/diffs/iteration-diff.js";
import { DiffPanel } from "../src/ui/diff-panel.js";

const rows: DiffRow[] = [
  { kind: "hunk", text: "@@ -999,2 +1234,2 @@" },
  { kind: "removed", oldLine: 999, text: "    old 🙂 e\u0301" },
  { kind: "added", newLine: 1234, text: "    new 界 e\u0301" },
  { kind: "context", oldLine: 1000, newLine: 1235, text: "\tcontext" },
];

function fixture(input = rows) {
  let draft = "existing draft";
  let editorCalls = 0;
  const panel = new DiffPanel({
    render() {}, close() {}, editor() { editorCalls++; },
    style: (_role, text) => `\x1b[32m${text}\x1b[39m`,
    appendContext(text) { draft += `\n\n${text}`; },
  });
  const view = { key: "one", title: "DIFF", notices: [], files: [
    { path: "a.ts", kind: "modified" as const, added: 1, removed: 1, getRows: () => input },
  ] };
  panel.setView(view);
  panel.handleInput("\r");
  return { panel, view, draft: () => draft, editorCalls: () => editorCalls };
}

function plain(panel: DiffPanel, width = 80): string[] {
  return panel.render(width).map(stripTerminalSequences);
}

test("footer advertises only definitive actions, including after horizontal pan", () => {
  const { panel } = fixture([{ kind: "added", newLine: 1, text: "  " + "long line ".repeat(12) }]);
  assert.ok(plain(panel, 100).at(-1)?.includes("d: details"));
  assert.ok(!plain(panel, 100).at(-1)?.includes("A/B"));
  panel.render(34);
  panel.handleInput("l");
  assert.ok(plain(panel, 100).at(-1)?.includes("[pan +8]"));
  assert.ok(plain(panel, 100)[5]?.includes("«"));
});

test("contextual gutter has one exact number, fixed signs and original indentation", () => {
  const { panel } = fixture();
  const lines = plain(panel);
  assert.equal(lines[6], "▏   999 -     old 🙂 e\u0301");
  assert.equal(lines[7], "▏  1234 +     new 界 e\u0301");
  assert.equal(lines[8], "▏  1235       context");
  assert.equal(visibleWidth(lines[7]!.split("new")[0]!), 14, "10 gutter cells + 4 original spaces; formerly 19");
  assert.equal(lines.length, 10, "one visual row per original row");
  for (const width of [1, 3, 8, 10, 11, 12, 17, 34]) {
    assert.ok(panel.render(width).every(line => visibleWidth(line) <= width));
  }
  panel.setPreferences({ lineNumbers: false });
  assert.equal(plain(panel)[7], "▏  +     new 界 e\u0301");
});

test("original indentation survives mouse/keyboard selection, settings and append", () => {
  const f = fixture();
  const p = f.panel;
  p.handleInput("\x1b[B"); // hunk
  p.handleInput("\x1b[B"); // removed
  p.handleInput("\x1b[1;2B"); // through added
  const expected = "[a.ts | diff | old:999 | new:1234]\n-    old 🙂 e\u0301\n+    new 界 e\u0301";
  assert.equal(p.formatSelectedContext(), expected);
  p.setPreferences({ lineNumbers: false });
  p.render(17);
  assert.equal(p.formatSelectedContext(), expected);
  const event = { button: "left" as const, x: 15, screenX: 15, width: 80, height: 24,
    shift: false, alt: false, ctrl: false };
  p.handleMouse({ ...event, type: "press", y: 6, screenY: 6 });
  p.handleMouse({ ...event, type: "drag", y: 7, screenY: 7 });
  p.handleMouse({ ...event, type: "release", y: 7, screenY: 7 });
  assert.equal(p.formatSelectedContext(), expected);
  p.handleInput("a");
  assert.equal(f.draft(), `existing draft\n\n${expected}`);
  assert.equal(f.editorCalls(), 1);
});

test("file header pans all its rows, independent offsets survive collapse and reset by iteration", () => {
  const long = "0123456789".repeat(9);
  const f = fixture([
    { kind: "removed", oldLine: 12, text: long },
    { kind: "added", newLine: 12, text: long },
  ]);
  const p = f.panel;
  const second = { ...f.view.files[0]!, path: "b.ts" };
  const v = { ...f.view, files: [...f.view.files, second] };
  p.setView(v);
  p.render(34);
  p.handleInput("l"); // still on file header, no line cursor needed
  const a = plain(p, 34).slice(5, 7);
  assert.ok(a.every(line => line.includes("«890123")), "both rows share offset 8");
  assert.ok(a.every(line => line.endsWith("»")));
  assert.equal(a[0]!.slice(0, 9), "▏    12 -", "gutter/sign stay fixed");
  p.handleInput("]"); p.handleInput("\r");
  assert.ok(plain(p, 34).slice(9, 11).every(line => line.includes(" 012345")), "second file starts at zero");
  p.handleInput("l"); p.handleInput("l");
  assert.ok(plain(p, 34).slice(9, 11).every(line => line.includes("«678901")));
  p.handleInput("["); p.handleInput("\r"); p.handleInput("\r");
  assert.deepEqual(plain(p, 34).slice(5, 7), a, "collapse/re-expand preserves pan");
  p.setView({ ...v });
  assert.deepEqual(plain(p, 34).slice(5, 7), a, "same-key publication keeps pan");
  p.setView({ ...v, key: "next" }); p.handleInput("\r");
  assert.ok(plain(p, 34).slice(5, 7).every(line => !line.includes("«")));
});

test("pan clamps at both ends, width changes and numbers Off; fitting rows never pan", () => {
  const long = "0123456789".repeat(5);
  const { panel: p } = fixture([{ kind: "added", newLine: 12345, text: long }]);
  const initial = plain(p, 34)[5]!;
  assert.equal(initial.slice(0, 11), "▏  12345 + ", "five-digit number has a fixed wider gutter");
  for (let n = 0; n < 30; n++) p.handleInput("l");
  const end = plain(p, 34)[5]!;
  assert.equal(end, "▏  12345 +«" + long.slice(-23));
  assert.ok(!end.endsWith("»"));
  p.handleInput("l"); assert.equal(plain(p, 34)[5], end);
  assert.equal(plain(p, 45)[5], "▏  12345 +«" + long.slice(-34), "widening clamps to final viewport");
  p.setPreferences({ lineNumbers: false });
  assert.equal(plain(p, 45)[5], "▏  +«" + long.slice(-40));
  assert.ok(!plain(p, 80)[5]!.includes("«"), "all code fits after resize");
  p.handleInput("l"); assert.ok(!plain(p, 80)[5]!.includes("«"));
  for (let n = 0; n < 30; n++) p.handleInput("h");
  assert.ok(!plain(p, 34)[5]!.includes("«"));
  for (const width of [1, 5, 10]) {
    p.render(width); p.handleInput("l");
    assert.ok(p.render(width).every(line => visibleWidth(line) <= width));
  }
});

test("Unicode/tabs/blank and short lines share visual offset without changing selections or context", () => {
  const text = "\t界🙂e\u0301" + "abcdefghij".repeat(5);
  const input: DiffRow[] = [
    { kind: "hunk", text: "@@ -1,3 +1,3 @@" },
    { kind: "removed", oldLine: 1, text },
    { kind: "added", newLine: 1, text: "x" },
    { kind: "context", oldLine: 2, newLine: 2, text: "" },
  ];
  const f = fixture(input);
  const p = f.panel;
  p.handleInput("\x1b[B"); p.handleInput("\r"); // whole hunk
  const context = p.formatSelectedContext();
  p.render(34); p.handleInput("l");
  const lines = plain(p, 34);
  assert.ok(lines[6]!.includes("«e\u0301abcdefghij"));
  assert.equal(lines[7], "▏     1 +«", "short row scrolls out rather than retaining its text");
  assert.ok(!lines[8]!.includes("«"), "blank row has no hidden text");
  assert.equal(p.formatSelectedContext(), context);
  p.handleInput("a");
  assert.equal(f.draft(), `existing draft\n\n${context}`);
  p.handleMouse({ type: "press", button: "left", x: 20, screenX: 20, y: 6, screenY: 6,
    width: 34, height: 24, shift: false, alt: false, ctrl: false });
  assert.equal(p.formatSelectedContext(), `[a.ts | diff | old:1]\n-${text}`);
  for (const width of [11, 12, 13, 14, 34]) {
    const rendered = p.render(width);
    assert.ok(rendered.every(line => visibleWidth(line) <= width));
    assert.ok(!stripTerminalSequences(rendered[6]!).includes("\ufffd"));
  }
});

test("same-key content changes invalidate width metrics without inheriting unbounded pan", () => {
  const f = fixture([{ kind: "added", newLine: 1, text: "x".repeat(100) }]);
  f.panel.render(34); f.panel.handleInput("l");
  f.panel.setView({ ...f.view, files: [{ ...f.view.files[0]!, getRows: () => [{ kind: "added", newLine: 1, text: "short" }] }] });
  assert.equal(plain(f.panel, 34)[5], "▏     1 + short");
});

test("clipping a wide glyph at the right boundary keeps the overflow marker in the last cell", () => {
  const { panel: p } = fixture([{ kind: "added", newLine: 1, text: "a界🙂e\u0301".repeat(8) }]);
  for (const width of [12, 13, 14, 15, 34]) {
    const line = plain(p, width)[5]!;
    assert.equal(visibleWidth(line), width);
    assert.equal(sliceByColumn(line, width - 1, 1), "»");
  }
});
