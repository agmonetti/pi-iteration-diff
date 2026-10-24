import assert from "node:assert/strict";
import { test } from "node:test";
import { Container, ScrollView, TuiAltScreen, VStack, stripTerminalSequences, visibleWidth, type Component, type Terminal, type TuiMouseEvent } from "@earendil-works/pi-tui";
import type { DiffFile, DiffRow, IterationView } from "../src/diffs/iteration-diff.js";
import { DiffPanel } from "../src/ui/diff-panel.js";
import { mountDock, type DockHandle } from "../src/ui/layout-adapter.js";

class TestTerminal implements Terminal {
  columns = 160;
  rows = 24;
  kittyProtocolActive = false;
  input: (data: string) => void = () => {};
  resize: () => void = () => {};
  start(input: (data: string) => void, resize: () => void): void { this.input = input; this.resize = resize; }
  stop(): void {}
  async drainInput(): Promise<void> {}
  write(): void {}
  moveBy(): void {}
  hideCursor(): void {}
  showCursor(): void {}
  clearLine(): void {}
  clearFromCursor(): void {}
  clearScreen(): void {}
  setTitle(): void {}
  setProgress(): void {}
  setProgramStatus(): void {}
}

function files(count: number, rows: readonly DiffRow[] = [
  { kind: "hunk", text: "@@ -1 +1 @@" },
  { kind: "removed", text: "old café", oldLine: 1 },
  { kind: "added", text: "new 🙂 e\u0301", newLine: 1 },
]): { files: DiffFile[]; calls: number[] } {
  const calls = Array<number>(count).fill(0);
  return { calls, files: Array.from({ length: count }, (_, index) => ({
    path: `file-${index}.ts`, kind: "modified", added: 1, removed: 1,
    getRows() { calls[index]++; return rows; },
  })) };
}
function view(input: readonly DiffFile[], key = "iteration-1"): IterationView {
  return { key, title: "DIFF: última iteración", notices: [], files: input };
}
function panel() {
  let editor = 0;
  let closed = 0;
  const roles: string[] = [];
  const panel = new DiffPanel({ render() {}, editor() { editor++; }, close() { closed++; },
    style(role, text) { roles.push(role); return text; } });
  return { panel, roles, editor: () => editor, closed: () => closed };
}
function mouse(type: TuiMouseEvent["type"], y: number, wheelDelta?: number): TuiMouseEvent {
  return { type, button: "left", x: 5, y, screenX: 5, screenY: y, width: 80, height: 24,
    shift: false, alt: false, ctrl: false, ...(wheelDelta === undefined ? {} : { wheelDelta }) };
}

for (const count of [0, 1, 10, 2_500]) {
  test(`${count} files start collapsed without requesting any diff rows`, () => {
    const f = files(count);
    const p = panel().panel;
    p.setView(view(f.files));
    const lines = p.render(100);
    assert.ok(lines.length <= 26);
    assert.ok(!lines.some(line => line.includes("@@")));
    assert.equal(f.calls.reduce((sum, n) => sum + n, 0), 0);
    if (count === 0) assert.ok(lines.some(line => line.includes("No changes observed")));
    else assert.ok(lines.some(line => line.includes("▸ M file-0.ts") && /\+1\s*\/\s*-1/.test(line)));
    if (count > 2_000) {
      p.handleInput("\x1b[F");
      assert.ok(p.render(100).some(line => line.includes("List truncated: 2000/2500")));
    }
  });
}

test("created/deleted kinds, exact zero statistics and unavailable notices stay honest while collapsed", () => {
  const p = panel().panel;
  const noRows = () => { throw new Error("collapsed content must stay lazy"); };
  p.setView(view([
    { path: "new.ts", kind: "created", added: 2, removed: 0, getRows: noRows },
    { path: "old.ts", kind: "deleted", added: 0, removed: 4, getRows: noRows },
    { path: "binary.dat", kind: "modified", notice: "Diff no disponible: archivo binario.", getRows: noRows },
  ]));
  const text = p.render(140).join("\n");
  assert.match(text, /A new\.ts \+2\s*\/\s*-0/);
  assert.match(text, /D old\.ts \+0\s*\/\s*-4/);
  assert.ok(text.includes("M binary.dat [stats unavailable]"));
  assert.ok(text.includes("Diff unavailable: binary file."));
  assert.ok(!/\[(?:created|modified|deleted)\]|\b(?:staged|unstaged|renamed|copied)\b|\?/.test(text));
});

test("up/down skip secondary path rows while file jumps target the three basename headers", () => {
  const p = panel().panel;
  p.setView(view([
    { path: "src/one.ts", kind: "modified", added: 1, removed: 0, getRows: () => [{ kind: "added", newLine: 1, text: "one" }] },
    { path: "src/two.ts", kind: "modified", added: 1, removed: 0, getRows: () => [{ kind: "added", newLine: 1, text: "two" }] },
    { path: "src/three.ts", kind: "modified", added: 1, removed: 0, getRows: () => [{ kind: "added", newLine: 1, text: "three" }] },
  ]));
  const active = (path: string): void => assert.ok(p.render(100).some(line => stripTerminalSequences(line).startsWith("▏> ▸ ") && line.includes(path)));
  p.handleInput("\x1b[B"); active("two.ts");
  p.handleInput("\x1b[B"); active("three.ts");
  p.handleInput("\x1b[B"); active("three.ts");
  p.handleInput("["); active("two.ts");
  p.handleInput("["); active("one.ts");
  p.handleInput("["); active("one.ts");
  p.handleInput("\r");
  p.handleInput("\x1b[B");
  p.handleInput("\x1b[B");
  assert.ok(p.render(100).some(line => stripTerminalSequences(line).startsWith("▏> ") && line.includes("+")), "expanded diff code remains navigable");
});

test("independent expansions preserve state across same key, focus, invalidate and width changes", () => {
  const f = files(3);
  const p = panel().panel;
  p.setView(view(f.files));
  p.handleInput("\r");
  p.handleInput("]");
  p.handleInput("\r");
  assert.ok(p.render(100).some(line => line.includes("▾ M file-0")));
  assert.ok(p.render(100).some(line => line.includes("▾ M file-1")));
  assert.ok(p.render(100).some(line => line.includes("▸ M file-2")));
  assert.equal(f.calls[2], 0);
  p.focused = true;
  p.focused = false;
  p.invalidate();
  p.render(8);
  p.setView(view(f.files));
  assert.equal(p.render(100).filter(line => line.includes("▾ M file-")).length, 2);
  p.handleInput("[");
  p.handleInput("\r");
  assert.ok(p.render(100).some(line => line.includes("▸ M file-0")));
  assert.ok(p.render(100).some(line => line.includes("▾ M file-1")));
  p.setView(view(f.files, "iteration-2"));
  assert.equal(p.render(100).filter(line => line.includes("▸ M file-")).length, 3);
  assert.ok(stripTerminalSequences(p.render(100)[3]!).startsWith("▏>"));
});

test("keyboard file/hunk navigation and Enter; only editor/close controls, no feedback", () => {
  const f = files(2);
  const state = panel();
  const p = state.panel;
  p.setView(view(f.files));
  p.handleInput("\r");
  p.handleInput("}");
  assert.ok(p.render(100).some(line => stripTerminalSequences(line).startsWith("▏>") && line.includes("@@")));
  p.handleInput("{"); // No earlier hunk: remains stable.
  p.handleInput("\x1b[A");
  p.handleInput("\r");
  assert.ok(p.render(100).some(line => line.includes("▸ M file-0")));
  p.handleInput("\x1b[B"); // Skip file 0's secondary path row.
  assert.ok(p.render(100).some(line => stripTerminalSequences(line).startsWith("▏> ▸ M file-1")));
  p.handleInput("\r");
  assert.ok(p.render(100).some(line => line.includes("▾ M file-1")));
  p.handleInput("a"); p.handleInput("d"); p.handleInput("c");
  assert.equal(state.editor(), 0);
  assert.equal(state.closed(), 0);
  p.handleInput("\x1b"); p.handleInput("\t"); p.handleInput("q");
  assert.equal(state.editor(), 2);
  assert.equal(state.closed(), 1);
});

test("header press/click toggles once, direct click toggles independently and wheel scrolls", () => {
  const f = files(40);
  const p = panel().panel;
  p.setView(view(f.files));
  assert.equal(p.handleMouse(mouse("press", 3))?.focus, true);
  p.handleMouse(mouse("release", 3));
  p.handleMouse(mouse("click", 3));
  assert.ok(p.render(100).some(line => line.includes("▾ M file-0")));
  p.handleMouse(mouse("click", 8));
  assert.ok(p.render(100).some(line => line.includes("▾ M file-1")));
  p.handleMouse(mouse("wheel", 3, 8));
  assert.ok(!p.render(100).some(line => line.includes("file-0.ts")));
  p.handleMouse(mouse("wheel", 3, -8));
  assert.ok(p.render(100).some(line => line.includes("▾ M file-0")));
});

test("large expanded content is visibly bounded and only viewport text is read", () => {
  let textReads = 0;
  const rows: DiffRow[] = Array.from({ length: 100_000 }, (_, index) => ({
    kind: "added", newLine: index + 1, get text() { textReads++; return `row-${index}`; },
  }));
  const f = files(8, rows);
  const p = panel().panel;
  p.setView(view(f.files));
  for (let index = 0; index < 8; index++) { p.handleInput("\r"); p.handleInput("]"); }
  assert.equal(f.calls[7], 0, "global cap avoids even asking for further expanded content");
  const before = textReads;
  p.render(100);
  assert.ok(textReads - before <= 22);
  p.handleInput("\x1b[F");
  assert.ok(p.render(120).some(line => line.includes("global limit of 12000 rows")));
  p.handleInput("\x1b[H");
  p.handleInput("]");
  p.handleInput("\x1b[A");
  assert.ok(p.render(160).some(line => line.includes("Diff truncated: 2000/100000")));
});

test("ANSI and control injection is removed from title, notices, paths and code; Unicode respects cells", () => {
  const injected = "\x1b[31mcafé\x1b[0m\x1b]8;;https://evil\x07🙂\x1b]8;;\x07 e\u0301\t\x00\r\n\u009b\u202e";
  const state = panel();
  const p = state.panel;
  p.setView({ key: "unsafe", title: injected, notices: [injected], files: [{
    path: injected, kind: "created", added: 1, removed: 0,
    getRows: () => [{ kind: "hunk", text: injected }, { kind: "added", newLine: 1, text: injected },
      { kind: "removed", oldLine: 1, text: injected }, { kind: "context", oldLine: 2, newLine: 2, text: injected }],
  }] });
  p.handleInput("\x1b[B"); p.handleInput("\r");
  for (const width of [1, 2, 3, 8, 34, 100]) {
    const lines = p.render(width);
    assert.ok(lines.every(line => visibleWidth(line) <= width));
    // Pi's trusted truncation helper emits SGR resets even for plain text.
    assert.ok(lines.every(line => !/[\x00-\x1f\x7f-\x9f\u202e]/.test(line.replaceAll(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""))));
    assert.ok(!lines.some(line => line.includes("https://evil")));
  }
  const text = p.render(100).join("\n");
  assert.ok(text.includes("café🙂 e\u0301    "));
  assert.match(text, /\s+1 \+ café/);
  assert.match(text, /1\s+- café/);
  assert.match(text, /2\s+café/);
  assert.ok(state.roles.includes("added"));
  assert.ok(state.roles.includes("removed"));
  assert.deepEqual(p.render(0), []);
});

test("real Pi viewport routes page navigation, wheel and resize independently of native transcript", () => {
  const terminal = new TestTerminal();
  terminal.rows = 9;
  const tui = new TuiAltScreen(terminal);
  const transcript = new Container();
  transcript.addChild({ invalidate() {}, render: () => Array.from({ length: 100 }, (_, i) => `native-${i}`) });
  let draft = "native draft";
  const editor: Component = { invalidate() {}, render: () => [draft], handleInput(data) { draft += data; } };
  tui.addChild(transcript); tui.addChild(editor);
  const nativeScroll = new ScrollView(transcript, { primary: true, follow: "end" });
  tui.setLayoutRoot(new VStack([{ component: nativeScroll, basis: 0, grow: 1 }, new VStack([editor])]));
  tui.setFocus(editor);
  let dock: DockHandle;
  const p = new DiffPanel({ render: () => tui.requestRender(), editor: () => dock.focusEditor(),
    close: () => dock.close(), style: (_role, text) => text });
  const f = files(100);
  p.setView(view(f.files));
  dock = mountDock(tui, p);
  tui.start();
  try {
    tui.renderNow(true);
    const nativeTop = nativeScroll.scrollTop;
    assert.ok(tui.getScreenLines().some(line => line.includes("file-0.ts")));
    dock.focusPanel();
    terminal.input("\x1b[6~");
    tui.renderNow(true);
    assert.ok(tui.getScreenLines().some(line => /▏> ▸ M file-[1-9]\d*\.ts/.test(stripTerminalSequences(line))), "Pi's global PageDown is routed to the dock cursor");
    terminal.input("\x1b[6~"); tui.renderNow(true);
    assert.equal(nativeScroll.scrollTop, nativeTop);
    terminal.input("\x1b[H"); tui.renderNow(true);
    terminal.input("\x1b[<65;140;4M"); tui.renderNow(true);
    assert.ok(!tui.getScreenLines().some(line => line.includes("file-0.ts")));
    assert.equal(nativeScroll.scrollTop, nativeTop);
    terminal.input("\x1b[5~"); terminal.input("\x1b[H"); tui.renderNow(true);
    terminal.input("\x1b[<0;140;5M"); terminal.input("\x1b[<0;140;5m"); tui.renderNow(true);
    assert.ok(tui.getScreenLines().some(line => line.includes("▾ M file-0.ts")));
    for (const height of [1, 2, 3]) {
      terminal.rows = height; terminal.resize(); tui.renderNow(true);
      assert.equal(tui.getScreenLines().length, height);
      assert.ok(tui.getScreenLines().every(line => visibleWidth(line) <= terminal.columns));
    }
    terminal.rows = 15; terminal.resize(); tui.renderNow(true);
    assert.ok(tui.getScreenLines().some(line => line.includes("▾ M file-0.ts")));
    terminal.input("\x1b"); terminal.input("!");
    assert.equal(draft, "native draft!");
  } finally { dock.close(); tui.stop(); }
});

test("responsive footer and file stats formatting with spaces", () => {
  const p = panel().panel;
  p.setView(view([{
    path: "src/balance.ts", kind: "modified", added: 3, removed: 2,
    getRows: () => [{ kind: "added", token: "line", oldLine: undefined, newLine: 12, text: "if (limit === 0) {" }],
  }]));
  // Expand file
  p.handleInput("\r");

  interface TestPanel {
    footer(width: number): string;
    entryLine(index: number, width: number): string;
  }
  const tp = p as unknown as TestPanel;

  // Narrow footer (< 50 cols)
  const narrowFooter = tp.footer(40);
  assert.ok(narrowFooter.includes("Enter: expand"));
  assert.ok(!narrowFooter.includes("↑↓: navigate"));

  // Standard footer
  const stdFooter = tp.footer(80);
  assert.ok(stdFooter.includes("↑↓: navigate"));

  // Cursor present on active index
  const activeRow = tp.entryLine(0, 50);
  assert.ok(activeRow.includes("> "));

  // File stats with spaces
  const fileHeader = tp.entryLine(0, 50);
  assert.match(fileHeader, /\+3\s*\/\s*-2/);
});



test("34-column headers keep status and exact counts when the path is long", () => {
  const p = panel().panel;
  p.setView(view([{
    path: "src/a-very-long-directory/long-name.ts", kind: "modified", added: 123, removed: 45,
    getRows: () => { throw new Error("collapsed file content was requested"); },
  }]));
  const header = p.render(34)[3]!;
  assert.ok(header.includes("M"));
  assert.match(header, /\+123\s*\/\s*-45/);
  assert.ok(visibleWidth(header) <= 34);
});

test("horizontal pan and inspection mode preserve long code and paths without irreversible truncation", () => {
  const state = panel();
  const p = state.panel;
  const longLine = "const deepProperty = object.very.long.chain.of.properties.that.extends.far.beyond.dock.width();";
  p.setView(view([{
    path: "src/deep/nested/directory/component.ts", kind: "modified", added: 1, removed: 0,
    getRows: () => [{ kind: "added", newLine: 1, text: longLine }],
  }]));
  // Expand file
  p.handleInput("\r");
  p.handleInput("\x1b[B"); // move to path line
  p.handleInput("\x1b[B"); // move to added code line

  // Initial code without pan
  const initial = p.render(50).find(line => line.includes("deepProperty"))!;
  assert.ok(initial.includes("deepProperty"));
  assert.ok(!initial.includes("«"));

  // Pan right by 8 columns
  p.handleInput("\x1b[C"); // right arrow
  const panned = p.render(50).find(line => line.includes("«"))!;
  assert.ok(panned.includes("«"));

  // Footer reflects pan state
  interface TestPanel { footer(width: number): string }
  const tp = p as unknown as TestPanel;
  assert.ok(tp.footer(60).includes("pan +8"));

  // Toggle inspection mode
  p.handleInput("i");
  assert.ok(tp.footer(80).includes("i: const deepProperty"));

  // Toggle off inspection
  p.handleInput("i");
  assert.ok(!tp.footer(80).includes("i: const deepProperty"));

  // Reset pan
  p.handleInput("0");
  const reset = p.render(50).find(line => line.includes("deepProperty"))!;
  assert.ok(!reset.includes("«"));
});

test("layout scales to 45% ratio on 90, 120, 160 and 200 columns preserving chat minimum size", () => {
  const terminal = new TestTerminal();
  const tui = new TuiAltScreen(terminal);
  const components = Array.from({ length: 4 }, () => new Container());
  components.forEach(child => tui.addChild(child));
  const native = new VStack([
    { component: new ScrollView(components[0]!, { primary: true, follow: "end" }), basis: 0, grow: 1 },
    new VStack(components.slice(1)),
  ]);
  tui.setLayoutRoot(native);
  const p = panel().panel;
  p.setView(view([{ path: "src/calc.ts", kind: "modified", added: 1, removed: 1, getRows: () => [] }]));
  const dock = mountDock(tui, p);
  tui.start();
  try {
    for (const cols of [90, 120, 160, 200]) {
      terminal.columns = cols;
      terminal.resize();
      tui.renderNow(true);
      const dockWidth = dock.getDockWidth();
      const expectedDock = Math.max(34, Math.min(cols - 46, Math.round(cols * 0.45)));
      assert.equal(dockWidth, expectedDock, `dock width at ${cols} columns`);
      assert.ok(cols - dockWidth >= 46, "chat preserves minimum size");
    }
  } finally { dock.close(); tui.stop(); }
});

test("keyboard shortcuts and mouse separator drag dynamically resize the dock and preserve ratio", () => {
  let resizedDelta = 0;
  let setCols = 0;
  const p = new DiffPanel({
    render() {},
    editor() {},
    close() {},
    style: (_r, t) => t,
    resize: (d) => { resizedDelta += d; },
    setDockWidth: (c) => { setCols = c; },
  });
  p.setView(view([{ path: "src/calc.ts", kind: "modified", added: 1, removed: 1, getRows: () => [] }]));

  // Keyboard resize shortcuts: < / > or Ctrl+Left / Ctrl+Right
  p.handleInput(">");
  assert.equal(resizedDelta, 4);
  p.handleInput("<");
  assert.equal(resizedDelta, 0);
  p.handleInput("\x1b[1;5C"); // Ctrl+Right
  assert.equal(resizedDelta, 4);
  p.handleInput("\x1b[1;5D"); // Ctrl+Left
  assert.equal(resizedDelta, 0);

  // Mouse drag on separator (x = 0)
  p.handleMouse({
    type: "press", button: "left", x: 0, y: 5, screenX: 66, screenY: 5, width: 54, height: 24,
    shift: false, alt: false, ctrl: false,
  });
  p.handleMouse({
    type: "drag", button: "left", x: -6, y: 5, screenX: 60, screenY: 5, width: 54, height: 24,
    shift: false, alt: false, ctrl: false,
  });
  assert.equal(setCols, 60);
  p.handleMouse({
    type: "release", button: "left", x: -6, y: 5, screenX: 60, screenY: 5, width: 54, height: 24,
    shift: false, alt: false, ctrl: false,
  });
});

test("two-line file headers display bold basename, status, stats and indented secondary relative path", () => {
  const p = panel().panel;
  p.setView(view([{
    path: "src/utils/calculator.ts", kind: "modified", added: 12, removed: 5,
    getRows: () => [],
  }]));
  const lines = p.render(60);
  // Line 1: Header with basename, chevron, status and stats
  const headerLine = lines[3]!;
  assert.ok(headerLine.includes("▸ M calculator.ts"));
  assert.ok(headerLine.includes(" M "));
  assert.match(headerLine, /\+12\s*\/\s*-5/);
  // Line 2: Secondary line with indented relative path
  const pathLine = lines[4]!;
  assert.ok(pathLine.includes("    src/utils/calculator.ts"));
});

test("independent file expansion works via Enter and click on either line 1 or line 2", () => {
  const p = panel().panel;
  p.setView(view([
    { path: "src/one.ts", kind: "modified", added: 1, removed: 1, getRows: () => [{ kind: "added", newLine: 1, text: "one" }] },
    { path: "src/two.ts", kind: "modified", added: 2, removed: 0, getRows: () => [{ kind: "added", newLine: 1, text: "two" }] },
  ]));

  // Expand file 1 via Enter on header; vertical navigation skips its path row.
  p.handleInput("\r");
  assert.ok(p.render(60).some(line => line.includes("▾ M one.ts")));
  assert.ok(p.render(60).some(line => line.includes("▸ M two.ts")));

  // Navigate through its visible diff rows, then collapse back to the header.
  p.handleInput("\x1b[B");
  p.handleInput("\x1b[B");
  p.handleInput("\x1b[B");
  p.handleInput("\x1b[A");
  p.handleInput("\x1b[A");
  p.handleInput("\x1b[A");
  p.handleInput("\r");
  assert.ok(p.render(60).some(line => line.includes("▸ M one.ts")));

  // Expand via mouse click on path line of file 1
  p.handleMouse({
    type: "press", button: "left", x: 5, y: 3, screenX: 5, screenY: 3, width: 60, height: 24,
    shift: false, alt: false, ctrl: false,
  });
  p.handleMouse({
    type: "click", button: "left", x: 5, y: 3, screenX: 5, screenY: 3, width: 60, height: 24,
    shift: false, alt: false, ctrl: false,
  });
  assert.ok(p.render(60).some(line => line.includes("▾ M one.ts")));
});

test("keyboard range selection with Shift+Up and Shift+Down selects contiguous rows and reflects old/new lines in footer", () => {
  const p = panel().panel;
  p.setView(view([{
    path: "src/calc.ts", kind: "modified", added: 2, removed: 1,
    getRows: () => [
      { kind: "hunk", text: "@@ -10,3 +10,4 @@" },
      { kind: "context", oldLine: 10, newLine: 10, text: "function calc() {" },
      { kind: "removed", oldLine: 11, text: "  return old;" },
      { kind: "added", newLine: 11, text: "  const a = 1;" },
      { kind: "added", newLine: 12, text: "  return a;" },
      { kind: "context", oldLine: 12, newLine: 13, text: "}" },
    ],
  }]));
  // Expand file
  p.handleInput("\r");
  // Ordinary navigation skips path; Shift navigation extends through diff rows.
  p.handleInput("\x1b[B"); // hunk
  p.handleInput("\x1b[B"); // context line 10
  p.handleInput("\x1b[B"); // removed line 11

  // Shift+Down to extend selection across added line 11 and added line 12
  p.handleInput("\x1b[1;2B"); // select removed 11 and added 11
  p.handleInput("\x1b[1;2B"); // select added 12

  interface TestPanel { footer(width: number): string }
  const footer = (p as unknown as TestPanel).footer(80);
  assert.ok(footer.includes("old:11"));
  assert.ok(footer.includes("new:11-12"));
  assert.ok(footer.includes("3 lines"));
  assert.ok(footer.includes("a: append to editor"));
});

test("hunk selection selects all rows in the hunk from hunk header", () => {
  const p = panel().panel;
  p.setView(view([{
    path: "src/calc.ts", kind: "modified", added: 1, removed: 1,
    getRows: () => [
      { kind: "hunk", text: "@@ -1,2 +1,2 @@" },
      { kind: "removed", oldLine: 1, text: "const a = 1;" },
      { kind: "added", newLine: 1, text: "const a = 2;" },
    ],
  }]));
  p.handleInput("\r"); // expand
  p.handleInput("\x1b[B"); // hunk header
  p.handleInput("\r"); // select hunk

  assert.equal(p.hasSelection(), true);
  const formatted = p.formatSelectedContext();
  assert.ok(formatted);
  assert.ok(formatted.includes("[src/calc.ts | diff | old:1 | new:1]"));
  assert.ok(formatted.includes("@@ -1,2 +1,2 @@"));
  assert.ok(formatted.includes("-const a = 1;"));
  assert.ok(formatted.includes("+const a = 2;"));
});

test("context transfer via 'a' formats selected snippet, appends to draft without replacement or auto-send, and focuses editor", () => {
  let draft = "User original instruction";
  let editorFocused = false;
  const p = new DiffPanel({
    render() {},
    editor() { editorFocused = true; },
    close() {},
    style: (_r, t) => t,
    appendContext: (snippet) => {
      draft = draft ? `${draft}\n\n${snippet}` : snippet;
    },
  });
  p.setView(view([{
    path: "src/utils/calculator.ts", kind: "modified", added: 2, removed: 1,
    getRows: () => [
      { kind: "hunk", text: "@@ -12,3 +12,4 @@" },
      { kind: "context", oldLine: 11, newLine: 11, text: "function calculateTotal(items) {" },
      { kind: "removed", oldLine: 12, text: "  return items.reduce(sum, 0);" },
      { kind: "added", newLine: 12, text: "  const valid = items.filter(Boolean);" },
      { kind: "added", newLine: 13, text: "  return valid.reduce(sum, 0);" },
      { kind: "context", oldLine: 13, newLine: 14, text: "}" },
    ],
  }]));
  p.handleInput("\r"); // expand
  p.handleInput("\x1b[B"); // hunk
  p.handleInput("\x1b[B"); // context
  p.handleInput("\x1b[B"); // removed 12
  p.handleInput("\x1b[1;2B"); // select removed 12 and added 12
  p.handleInput("\x1b[1;2B"); // select added 13

  // Press 'a' to transfer
  p.handleInput("a");

  assert.equal(editorFocused, true, "focus returned to editor");
  assert.ok(draft.startsWith("User original instruction\n\n"), "draft preserved and appended");
  assert.ok(draft.includes("[src/utils/calculator.ts | diff | old:12 | new:12-13]"));
  assert.ok(draft.includes("-  return items.reduce(sum, 0);"));
  assert.ok(draft.includes("+  const valid = items.filter(Boolean);"));
  assert.ok(draft.includes("+  return valid.reduce(sum, 0);"));
  assert.ok(!draft.includes("FIX"), "no FIX prompt injected");
  assert.ok(!draft.includes("DISCUSS"), "no DISCUSS prompt injected");
});

test("compact header formats concise status for Batch Net, cancelled, partial, and empty iterations without fake tabs", () => {
  const p = panel().panel;

  // Normal iteration with files
  p.setView({ key: "k1", title: "Última iteración", notices: [], files: [
    { path: "a.ts", kind: "modified", added: 3, removed: 1, getRows: () => [] },
    { path: "b.ts", kind: "created", added: 5, removed: 0, getRows: () => [] },
  ] });
  let lines = p.render(80);
  assert.match(stripTerminalSequences(lines[0]!), /^🭽▔*$/);
  assert.ok(lines[1]!.includes("DIFF · Last iteration"));
  assert.ok(lines[1]!.includes("2 files"));
  assert.ok(lines[2]!.includes("+8 / -1"));
  assert.ok(!lines[1]!.includes("Current"));
  assert.ok(!lines[1]!.includes("History"));

  // Batch net
  p.setView({ key: "k2", title: "Ventana agrupada · diff neto", notices: [], files: [
    { path: "a.ts", kind: "modified", added: 2, removed: 0, getRows: () => [] },
  ] });
  lines = p.render(80);
  assert.ok(lines[1]!.includes("DIFF · Batch Net"));
  assert.ok(lines[1]!.includes("1 file"));
  assert.ok(lines[2]!.includes("+2 / -0"));

  // Cancelled
  p.setView({ key: "k3", title: "Ejecución cancelada", notices: [], files: [
    { path: "a.ts", kind: "modified", added: 1, removed: 0, getRows: () => [] },
  ] });
  lines = p.render(80);
  assert.ok(lines[1]!.includes("DIFF · Cancelled"));
  assert.ok(lines[1]!.includes("1 file"));
  assert.ok(lines[2]!.includes("+1 / -0"));

  // Empty iteration
  p.setView({ key: "k4", title: "Última iteración", notices: [], files: [] });
  lines = p.render(80);
  assert.ok(lines[1]!.includes("DIFF · Last iteration"));
  assert.ok(lines[1]!.includes("0 files"));
  assert.ok(lines[2]!.includes("No changes"));
});

test("compact gutter differentiates created, deleted, and modified files with maximum usable code space", () => {
  const p = panel().panel;
  p.setView({
    key: "gutter-kinds",
    title: "Última iteración",
    notices: [],
    files: [
      {
        path: "src/new-feature.ts",
        kind: "created",
        added: 2,
        removed: 0,
        getRows: () => [
          { kind: "hunk", text: "@@ -0,0 +1,2 @@" },
          { kind: "added", newLine: 1, text: "export const answer = 42;" },
          { kind: "added", newLine: 2, text: "export const pi = 3.14;" },
        ],
      },
      {
        path: "src/legacy.ts",
        kind: "deleted",
        added: 0,
        removed: 1,
        getRows: () => [
          { kind: "hunk", text: "@@ -1,1 +0,0 @@" },
          { kind: "removed", oldLine: 1, text: "export const deprecated = true;" },
        ],
      },
      {
        path: "src/calculator.ts",
        kind: "modified",
        added: 1,
        removed: 1,
        getRows: () => [
          { kind: "hunk", text: "@@ -5,3 +5,3 @@" },
          { kind: "context", oldLine: 5, newLine: 5, text: "function compute() {" },
          { kind: "removed", oldLine: 6, text: "  return oldSum;" },
          { kind: "added", newLine: 6, text: "  return newSum;" },
        ],
      },
    ],
  });

  // Expand all three files
  p.handleInput("\r"); // expand new-feature.ts
  p.handleInput("]");
  p.handleInput("\r"); // expand legacy.ts
  p.handleInput("]");
  p.handleInput("\r"); // expand calculator.ts

  const rendered = p.render(120).join("\n");

  // 1. Created file has single new column (no wasted dual gutter columns)
  assert.match(rendered, /\s+1 \+ export const answer/);
  assert.match(rendered, /\s+2 \+ export const pi/);

  // 2. Deleted file has single old column
  assert.match(rendered, /\s+1 - export const deprecated/);

  // 3. Modified files use the contextual number too.
  assert.match(rendered, /\s+5\s+function compute/);
  assert.match(rendered, /\s+6\s+-\s+return oldSum/);
  assert.match(rendered, /\s+6\s+\+\s+return newSum/);
});

test("usable code width comparison across 90, 120, 160, and 200 column terminals", () => {
  const p = panel().panel;
  const longCode = "const result = performVeryLongCalculationWithMultipleParameters(alpha, beta, gamma, delta, epsilon);";
  p.setView({
    key: "width-check",
    title: "Última iteración",
    notices: [],
    files: [
      {
        path: "src/created.ts",
        kind: "created",
        added: 1,
        removed: 0,
        getRows: () => [
          { kind: "hunk", text: "@@ -0,0 +1,1 @@" },
          { kind: "added", newLine: 1, text: longCode },
        ],
      },
    ],
  });
  p.handleInput("\r"); // expand

  for (const terminalCols of [90, 120, 160, 200]) {
    const dockCols = Math.max(34, Math.round(terminalCols * 0.45));
    const lines = p.render(dockCols);
    const codeLine = lines.find(line => line.includes("performVery"))!;
    assert.ok(codeLine, `code rendered in ${dockCols} cols (terminal ${terminalCols})`);
    assert.ok(visibleWidth(codeLine) <= dockCols, `line respects dock width ${dockCols}`);

    // In created file, prefix + gutter is exactly 10 cols, leaving dockCols - 10 cols for code
    // At terminalCols = 90 (dock = 41 cols), code has 31 usable cols (vs 26 previously)
    if (dockCols === 41) {
      assert.ok(codeLine.includes("const result = performVeryLo"));
    }
  }
});

test("technical notices are omitted in normal view and toggled under demand via 'd' and header click", () => {
  const p = panel().panel;
  p.setView({
    key: "notices-toggle",
    title: "Última iteración",
    notices: [
      "Diff neto entre snapshots de la ventana; no demuestra autoría ni conserva escrituras intermedias.",
      "Límites del visor: 64 archivos; 256 KiB y 2000 líneas por archivo...",
      "Rutas omitidas en los snapshots: 2 antes; 3 después.",
    ],
    files: [
      {
        path: "src/app.ts",
        kind: "modified",
        added: 1,
        removed: 0,
        getRows: () => [{ kind: "added", newLine: 1, text: "console.log('hello');" }],
      },
    ],
  });

  // 1. In normal view: routine notices are not rendered in the file list
  let lines = p.render(100);
  assert.ok(!lines.some(l => l.includes("Net diff between")));
  assert.ok(!lines.some(l => l.includes("Viewer limits")));
  // File header follows the top border and two title rows.
  assert.ok(lines[3]!.includes("app.ts"));

  // 2. Press 'd': details view is enabled and technical notices are rendered
  p.handleInput("d");
  lines = p.render(100);
  assert.ok(lines.some(l => l.includes("Net diff between")));
  assert.ok(lines.some(l => l.includes("Viewer limits")));

  // 3. Press 'd' again: toggles back to clean normal view
  p.handleInput("d");
  lines = p.render(100);
  assert.ok(!lines.some(l => l.includes("Net diff between")));

  // 4. Mouse click on the title row (y = 1): toggles details view on demand
  p.handleMouse({
    type: "click", button: "left", x: 10, y: 1, screenX: 10, screenY: 1, width: 100, height: 24,
    shift: false, alt: false, ctrl: false,
  });
  lines = p.render(100);
  assert.ok(lines.some(l => l.includes("Net diff between")));
});

test("differentiates intentional path omissions from partial captures in header and details", () => {
  const p = panel().panel;

  // Window with intentional policy omissions: does NOT show [omissions] in header
  p.setView({
    key: "omissions-header",
    title: "Última iteración",
    notices: ["Rutas omitidas en los snapshots: 4 antes; 1 después."],
    files: [{ path: "src/worker.ts", kind: "modified", added: 1, removed: 0, getRows: () => [] }],
  });
  const omissionLines = p.render(100);
  assert.ok(omissionLines[1]!.includes("DIFF · Last iteration"));
  assert.ok(!omissionLines[1]!.includes("[omisiones]"));
  assert.ok(!omissionLines[1]!.includes("[omissions]"));

  // Incomplete / partial window: displays Partial scope badge
  p.setView({
    key: "partial-header",
    title: "Iteración · resultado no completo",
    notices: ["Captura incompleta: pueden faltar archivos o cambios; la ausencia de cambios no demuestra un resultado vacío."],
    files: [{ path: "src/worker.ts", kind: "modified", added: 1, removed: 0, getRows: () => [] }],
  });
  const partialLines = p.render(100);
  assert.ok(partialLines[1]!.includes("DIFF · Partial"));
});

test("panel focus uses a real top border and matching left corner without changing dimensions", () => {
  const roles: string[] = [];
  const p = new DiffPanel({ render() {}, editor() {}, close() {}, style(role, text) {
    roles.push(role);
    return role === "accent" ? `\x1b[35m${text}\x1b[39m` : text;
  } });
  p.setView(view([{ path: "src/a.ts", kind: "modified", added: 1, removed: 0, getRows: () => [] }]));
  const unfocused = p.render(60);
  p.focused = true;
  const focused = p.render(60);
  assert.equal(focused.length, unfocused.length);
  assert.match(stripTerminalSequences(focused[0]!), /^🭽▔*$/);
  assert.ok(focused.slice(1).every(line => stripTerminalSequences(line).startsWith("▏")), "focused dock border is thin");
  assert.match(stripTerminalSequences(unfocused[0]!), /^🭽▔*$/);
  assert.ok(unfocused.slice(1).every(line => stripTerminalSequences(line).startsWith("▏")), "unfocused border uses dim line");
  assert.equal(visibleWidth(focused[0]!), visibleWidth(unfocused[0]!));
  assert.ok(!focused.join("").includes("\x1b[53m"));
  assert.ok(!focused.join("").includes("\x1b[55m"));
  assert.ok(roles.includes("accent"));
  assert.ok(roles.includes("dim"));
  assert.ok(roles.includes("border"));
  assert.equal(stripTerminalSequences(focused[1]!).slice(0, 1), "▏");
});

test("selected lines preserve continuous dock border and apply selectedBg to content", () => {
  const state = panel();
  const p = state.panel;
  p.setView({
    key: "selection-style",
    title: "Última iteración",
    notices: [],
    files: [
      {
        path: "src/index.ts",
        kind: "modified",
        added: 2,
        removed: 0,
        getRows: () => [
          { kind: "hunk", text: "@@ -1,1 +1,3 @@" },
          { kind: "added", newLine: 1, text: "first line" },
          { kind: "added", newLine: 2, text: "second line" },
        ],
      },
    ],
  });
  p.handleInput("\r"); // expand
  p.handleInput("\x1b[B"); // path
  p.handleInput("\x1b[B"); // hunk
  p.handleInput("\x1b[B"); // added 1
  p.handleInput("\x1b[1;2B"); // select added 1 and 2

  assert.equal(p.hasSelection(), true);
  const lines = p.render(80);
  // Selected line has border '│' at column 0 and uses selectedBg
  const selectedLine = lines.find(l => l.includes("first line"))!;
  assert.ok(stripTerminalSequences(selectedLine).startsWith("▏"));
  assert.ok(state.roles.includes("selectedBg"));
  assert.ok(state.roles.includes("border"));
});

test("two-line header across widths 34, 45, 60, 100, dark/light themes, all states and English-only labels", () => {
  const recordedRoles: string[] = [];
  let isLightTheme = false;
  const p = new DiffPanel({
    render() {},
    editor() {},
    close() {},
    style(role, text) {
      recordedRoles.push(role);
      if (isLightTheme) {
        if (role === "added") return `\x1b[32m${text}\x1b[39m`;
        if (role === "removed") return `\x1b[31m${text}\x1b[39m`;
        if (role === "dim") return `\x1b[90m${text}\x1b[39m`;
        if (role === "border") return `\x1b[37m${text}\x1b[39m`;
        return text;
      }
      if (role === "added") return `\x1b[32m${text}\x1b[39m`;
      if (role === "removed") return `\x1b[31m${text}\x1b[39m`;
      if (role === "dim") return `\x1b[2m${text}\x1b[22m`;
      return text;
    },
  });

  const states: Array<{ title: string; notices: string[]; expectedScope: string; files: DiffFile[] }> = [
    {
      title: "Última iteración",
      notices: [],
      expectedScope: "Last iteration",
      files: [{ path: "src/a.ts", kind: "modified", added: 12, removed: 4, getRows: () => [] }],
    },
    {
      title: "Iteración · resultado no completo",
      notices: ["Captura incompleta: pueden faltar archivos o cambios; la ausencia de cambios no demuestra un resultado vacío."],
      expectedScope: "Partial",
      files: [{ path: "src/b.ts", kind: "created", added: 5, removed: 0, getRows: () => [] }],
    },
    {
      title: "Ventana agrupada · diff neto",
      notices: ["Ventana agrupada (2 entradas observadas): no es la última iteración individual."],
      expectedScope: "Batch Net",
      files: [{ path: "src/c.ts", kind: "deleted", added: 0, removed: 7, getRows: () => [] }],
    },
    {
      title: "Ejecución cancelada",
      notices: ["Ejecución cancelada: solo se muestran cambios netos observados."],
      expectedScope: "Cancelled",
      files: [{ path: "src/d.ts", kind: "modified", added: 1, removed: 0, getRows: () => [] }],
    },
    {
      title: "La ejecución falló",
      notices: ["La ejecución falló: solo se muestran cambios netos observados."],
      expectedScope: "Failed",
      files: [{ path: "src/e.ts", kind: "modified", added: 2, removed: 1, getRows: () => [] }],
    },
    {
      title: "Diff no disponible",
      notices: ["No hay una captura de iteración disponible."],
      expectedScope: "Unavailable",
      files: [],
    },
    {
      title: "Última iteración",
      notices: ["Sin cambios netos observados en esta ventana."],
      expectedScope: "Last iteration",
      files: [],
    },
  ];

  for (const st of states) {
    p.setView({ key: `st-${st.expectedScope}`, title: st.title, notices: st.notices, files: st.files });

    for (const w of [34, 45, 60, 100]) {
      const rendered = p.render(w);
      const border = rendered[0]!;
      const line0 = rendered[1]!;
      const line1 = rendered[2]!;

      assert.match(stripTerminalSequences(border), /^🭽▔*$/);
      assert.ok(visibleWidth(border) <= w, `border width ${visibleWidth(border)} exceeds ${w}`);
      assert.ok(visibleWidth(line0) <= w, `line 0 width ${visibleWidth(line0)} exceeds ${w}`);
      assert.ok(visibleWidth(line1) <= w, `line 1 width ${visibleWidth(line1)} exceeds ${w}`);

      assert.ok(line0.includes(`DIFF · ${st.expectedScope}`), `line 0 missing scope ${st.expectedScope} at width ${w}`);
      const fileCountWord = st.files.length === 1 ? "1 file" : `${st.files.length} files`;
      assert.ok(line0.includes(fileCountWord), `line 0 missing file count ${fileCountWord} at width ${w}`);

      if (st.files.length === 0) {
        assert.ok(line1.includes("No changes"), `line 1 should show No changes for empty state at width ${w}`);
      } else {
        const added = st.files.reduce((sum, f) => sum + (f.added ?? 0), 0);
        const removed = st.files.reduce((sum, f) => sum + (f.removed ?? 0), 0);
        assert.ok(line1.includes(`+${added}`), `line 1 missing added stats +${added}`);
        assert.ok(line1.includes(`-${removed}`), `line 1 missing removed stats -${removed}`);
      }

      const fullText = rendered.join("\n");
      assert.ok(!fullText.includes("Última iteración"));
      assert.ok(!fullText.includes("Ventana agrupada"));
      assert.ok(!fullText.includes("cancelada"));
      assert.ok(!fullText.includes("fallida"));
      assert.ok(!fullText.includes("Sin cambios"));
      assert.ok(!fullText.includes("creado"));
      assert.ok(!fullText.includes("modificado"));
      assert.ok(!fullText.includes("eliminado"));
      assert.ok(!fullText.includes("expandir"));
      assert.ok(!fullText.includes("anexar"));
      assert.ok(!fullText.includes("navegar"));
    }
  }

  assert.ok(recordedRoles.includes("added"), "must use 'added' semantic role");
  assert.ok(recordedRoles.includes("removed"), "must use 'removed' semantic role");
  assert.ok(recordedRoles.includes("dim"), "must use 'dim' semantic role");
  assert.ok(recordedRoles.includes("border"), "must use 'border' semantic role");

  isLightTheme = true;
  p.render(60);
});

test("preferences defaults to On/Smart/On and getPreferences returns a copy", () => {
  const p = new DiffPanel({
    render() {}, editor() {}, close() {}, style: (_r, t) => t,
  });
  const prefs = p.getPreferences();
  assert.equal(prefs.lineNumbers, true);
  assert.equal(prefs.filePaths, "Smart");
  assert.equal(prefs.collapseFiles, true);
});

test("collapseFiles:false in constructor expands all files on new view key; setPreferences preserves expansions", () => {
  const p = new DiffPanel({
    render() {}, editor() {}, close() {}, style: (_r, t) => t,
  }, { collapseFiles: false });

  const f1: DiffFile = { path: "src/a.ts", kind: "modified", added: 1, removed: 0, getRows: () => [{ kind: "added", newLine: 1, text: "const a = 1;" }] };
  const f2: DiffFile = { path: "src/b.ts", kind: "modified", added: 1, removed: 0, getRows: () => [{ kind: "added", newLine: 1, text: "const b = 2;" }] };

  // New view.key 'v1': both files should start expanded
  p.setView({ key: "v1", title: "DIFF", notices: [], files: [f1, f2] });
  let rendered = p.render(80).join("\n");
  assert.ok(rendered.includes("▾ M a.ts"));
  assert.ok(rendered.includes("▾ M b.ts"));
  assert.ok(rendered.includes("const a = 1;"));
  assert.ok(rendered.includes("const b = 2;"));

  // setPreferences({ collapseFiles: true }) does NOT collapse currently open files
  p.setPreferences({ collapseFiles: true });
  rendered = p.render(80).join("\n");
  assert.ok(rendered.includes("▾ M a.ts"));
  assert.ok(rendered.includes("▾ M b.ts"));

  // Next view.key 'v2': applies updated collapseFiles:true default (both start collapsed)
  p.setView({ key: "v2", title: "DIFF", notices: [], files: [f1, f2] });
  rendered = p.render(80).join("\n");
  assert.ok(rendered.includes("▸ M a.ts"));
  assert.ok(rendered.includes("▸ M b.ts"));
  assert.ok(!rendered.includes("const a = 1;"));
});

test("setPreferences applies presentation without resetting active selection, cursor or expansions", () => {
  const p = new DiffPanel({
    render() {}, editor() {}, close() {}, style: (_r, t) => t,
  });
  const f: DiffFile = {
    path: "src/module.ts", kind: "modified", added: 2, removed: 0,
    getRows: () => [
      { kind: "hunk", text: "@@ -1,1 +1,3 @@" },
      { kind: "added", newLine: 1, text: "first" },
      { kind: "added", newLine: 2, text: "second" },
    ],
  };
  p.setView({ key: "k1", title: "DIFF", notices: [], files: [f] });

  // Expand file
  p.handleInput("\r");
  assert.ok(p.render(80).some(line => line.includes("▾ M module.ts")));

  // Navigate to code row and select range
  p.handleInput("\x1b[B"); // hunk
  p.handleInput("\x1b[B"); // first row
  p.handleInput("\x1b[1;2B"); // shift+down to select first and second rows
  assert.ok(p.hasSelection());

  // Apply preference update
  p.setPreferences({ lineNumbers: false, filePaths: "Filename" });

  // Selection is preserved
  assert.ok(p.hasSelection());
  // File is still expanded
  assert.ok(p.render(80).some(line => line.includes("▾ M module.ts")));
  // Footer still shows selected lines
  const footer = p.render(80)[p.render(80).length - 1]!;
  assert.ok(footer.includes("selected") || footer.includes("Sel:"));
});

test("lineNumbers Off removes numeric gutter while keeping diff signs and code content", () => {
  const p = new DiffPanel({
    render() {}, editor() {}, close() {}, style: (_r, t) => t,
  }, { lineNumbers: false });

  const f: DiffFile = {
    path: "src/example.ts", kind: "modified", added: 1, removed: 1,
    getRows: () => [
      { kind: "hunk", text: "@@ -10 +10 @@" },
      { kind: "removed", oldLine: 10, text: "console.log('old');" },
      { kind: "added", newLine: 10, text: "console.log('new');" },
    ],
  };
  p.setView({ key: "nums-test", title: "DIFF", notices: [], files: [f] });
  p.handleInput("\r"); // Expand

  const lines = p.render(80);
  const removedLine = lines.find(l => l.includes("console.log('old');"))!;
  const addedLine = lines.find(l => l.includes("console.log('new');"))!;

  // Must contain diff sign
  assert.ok(removedLine.includes("- console.log('old');"), `Should contain sign: ${removedLine}`);
  assert.ok(addedLine.includes("+ console.log('new');"), `Should contain sign: ${addedLine}`);

  // Must NOT contain line numbers
  assert.ok(!removedLine.includes("  10"), `Should not contain numeric line gutter: ${removedLine}`);
  assert.ok(!addedLine.includes("  10"), `Should not contain numeric line gutter: ${addedLine}`);
});

test("filePaths Filename maintains two-line header geometry with indented basename on second line", () => {
  const p = new DiffPanel({
    render() {}, editor() {}, close() {}, style: (_r, t) => t,
  }, { filePaths: "Filename" });

  const f: DiffFile = {
    path: "packages/core/src/sub/deep-component.tsx", kind: "modified", added: 3, removed: 1,
    getRows: () => [],
  };
  p.setView({ key: "paths-fn", title: "DIFF", notices: [], files: [f] });

  const lines = p.render(60);
  // Line 1: Header with basename, chevron, status and stats
  const headerLine = lines[3]!;
  assert.ok(headerLine.includes("▸ M deep-component.tsx"));
  assert.match(headerLine, /\+3\s*\/\s*-1/);

  // Line 2: Secondary line with indented basename, NOT the full path
  const pathLine = lines[4]!;
  assert.ok(pathLine.includes("    deep-component.tsx"));
  assert.ok(!pathLine.includes("packages/core/src/sub"));
});

test("filePaths Full shows relative path truncated at end without middle ellipsis", () => {
  const p = new DiffPanel({
    render() {}, editor() {}, close() {}, style: (_r, t) => t,
  }, { filePaths: "Full" });

  const f: DiffFile = {
    path: "packages/nested/long/directory/structure/file-to-render.ts", kind: "modified", added: 1, removed: 0,
    getRows: () => [],
  };
  p.setView({ key: "paths-full", title: "DIFF", notices: [], files: [f] });

  const lines = p.render(40);
  const pathLine = lines[4]!;
  const stripped = stripTerminalSequences(pathLine);
  // Should NOT contain middle ellipsis '…/'
  assert.ok(!stripped.includes("/…/"), `Full mode must not use middle ellipsis: ${stripped}`);
  // Should start with directory path and truncate at end with '…'
  assert.ok(stripped.includes("packages/nested/"));
  assert.ok(stripped.endsWith("…"), `Full mode must end with ellipsis: ${stripped}`);
});

test("filePaths Smart uses smart middle truncation respecting Unicode columns", () => {
  const p = new DiffPanel({
    render() {}, editor() {}, close() {}, style: (_r, t) => t,
  }, { filePaths: "Smart" });

  const f: DiffFile = {
    path: "packages/nested/long/directory/structure/file-to-render.ts", kind: "modified", added: 1, removed: 0,
    getRows: () => [],
  };
  p.setView({ key: "paths-smart", title: "DIFF", notices: [], files: [f] });

  const lines = p.render(40);
  const pathLine = lines[4]!;
  // Smart mode preserves first dir and filename with middle ellipsis
  assert.ok(pathLine.includes("/…/file-to-render.ts") || pathLine.includes("…/file-to-render.ts"));
  assert.ok(visibleWidth(stripTerminalSequences(pathLine)) <= 40);
});

test("formatSelectedContext preserves full path identity regardless of filePaths preference", () => {
  const p = new DiffPanel({
    render() {}, editor() {}, close() {}, style: (_r, t) => t,
  }, { filePaths: "Filename" });

  const fullPath = "very/deeply/nested/path/to/target.ts";
  const f: DiffFile = {
    path: fullPath, kind: "modified", added: 1, removed: 0,
    getRows: () => [
      { kind: "hunk", text: "@@ -1 +1,2 @@" },
      { kind: "added", newLine: 2, text: "export const x = 1;" },
    ],
  };
  p.setView({ key: "ctx-id", title: "DIFF", notices: [], files: [f] });
  p.handleInput("\r"); // Expand
  p.handleInput("\x1b[B"); // hunk
  p.handleInput("\x1b[B"); // row
  p.handleInput("\r"); // select row

  const context = p.formatSelectedContext();
  assert.ok(context, "Context should be formatted");
  assert.ok(context.includes(`[${fullPath} | diff | new:2]`), `Context must use canonical path: ${context}`);
  assert.ok(context.includes("+export const x = 1;"));
});

test("Actions.resizeEnd is invoked on separator release, not on selection drag release", () => {
  let resizeEndCalls = 0;
  let setDockWidthCols = 0;
  const p = new DiffPanel({
    render() {}, editor() {}, close() {}, style: (_r, t) => t,
    setDockWidth: (cols) => { setDockWidthCols = cols; },
    resizeEnd: () => { resizeEndCalls++; },
  });

  p.setView(view([{
    path: "src/test.ts", kind: "modified", added: 1, removed: 0,
    getRows: () => [{ kind: "added", newLine: 1, text: "code" }],
  }]));

  // 1. Separator resize drag & release invokes resizeEnd once
  p.handleMouse({
    type: "press", button: "left", x: 0, y: 5, screenX: 60, screenY: 5, width: 50, height: 24,
    shift: false, alt: false, ctrl: false,
  });
  p.handleMouse({
    type: "drag", button: "left", x: -4, y: 5, screenX: 56, screenY: 5, width: 50, height: 24,
    shift: false, alt: false, ctrl: false,
  });
  assert.equal(setDockWidthCols, 54);
  assert.equal(resizeEndCalls, 0); // Not called yet during drag

  p.handleMouse({
    type: "release", button: "left", x: -4, y: 5, screenX: 56, screenY: 5, width: 50, height: 24,
    shift: false, alt: false, ctrl: false,
  });
  assert.equal(resizeEndCalls, 1); // Called on separator release

  // 2. Selection drag & release does NOT invoke resizeEnd
  p.handleInput("\r"); // Expand file
  p.handleMouse({
    type: "press", button: "left", x: 10, y: 5, screenX: 70, screenY: 5, width: 50, height: 24,
    shift: false, alt: false, ctrl: false,
  });
  p.handleMouse({
    type: "drag", button: "left", x: 10, y: 6, screenX: 70, screenY: 6, width: 50, height: 24,
    shift: false, alt: false, ctrl: false,
  });
  p.handleMouse({
    type: "release", button: "left", x: 10, y: 6, screenX: 70, screenY: 6, width: 50, height: 24,
    shift: false, alt: false, ctrl: false,
  });
  assert.equal(resizeEndCalls, 1); // Still 1, no resizeEnd on selection drag!
});

test("setPreferences applies visual settings in-place on open dock preserving state", () => {
  let renders = 0;
  const p = new DiffPanel({
    render() { renders++; },
    editor() {},
    close() {},
    style: (_r, t) => t,
  });

  const f: DiffFile = {
    path: "src/deep/nested/component.tsx",
    kind: "modified",
    added: 1,
    removed: 1,
    getRows: () => [
      { kind: "hunk", text: "@@ -1,1 +1,1 @@" },
      { kind: "removed", oldLine: 1, text: "const old = 1;" },
      { kind: "added", newLine: 1, text: "const new = 2;" },
    ],
  };
  p.setView({ key: "v1", title: "DIFF", notices: [], files: [f] });
  p.handleInput("\r"); // Expand file

  // Initially: lineNumbers = true, filePaths = "Smart"
  let lines = p.render(80);
  assert.ok(lines.some(l => l.includes("▾ M component.tsx")));
  assert.ok(lines.some(l => l.includes("1") && l.includes("- const old = 1;")));

  // 1. Hot update lineNumbers: false hides gutter numbers immediately
  p.setPreferences({ lineNumbers: false });
  lines = p.render(80);
  assert.ok(lines.some(l => l.includes("▾ M component.tsx")));
  const removedRow = lines.find(l => l.includes("- const old = 1;"))!;
  assert.ok(!removedRow.includes("   1 -"));

  // 2. Hot update filePaths: "Filename" shows basename immediately
  p.setPreferences({ filePaths: "Filename" });
  lines = p.render(80);
  assert.ok(lines[4]!.includes("component.tsx"));
  assert.ok(!lines[4]!.includes("src/deep/nested"));

  // 3. Hot update filePaths: "Full" shows full path immediately
  p.setPreferences({ filePaths: "Full" });
  lines = p.render(80);
  assert.ok(lines[4]!.includes("src/deep/nested/component.tsx"));

  // 4. Hot update collapseFiles: true does NOT collapse already expanded files
  p.setPreferences({ collapseFiles: true });
  lines = p.render(80);
  assert.ok(lines.some(l => l.includes("▾ M component.tsx")));
  assert.ok(lines.some(l => l.includes("const new = 2;")));

  // Next iteration with collapseFiles: true WILL collapse files
  p.setView({ key: "v2", title: "DIFF", notices: [], files: [f] });
  lines = p.render(80);
  assert.ok(lines.some(l => l.includes("▸ M component.tsx")));
  assert.ok(renders > 0);
});

