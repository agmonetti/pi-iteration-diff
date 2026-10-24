import assert from "node:assert/strict";
import { test } from "node:test";
import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
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

test("compact rendering leaves mouse/keyboard ranges and appended context byte-identical", () => {
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
