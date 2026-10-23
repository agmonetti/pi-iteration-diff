import assert from "node:assert/strict";
import { test } from "node:test";
import { Container, ScrollView, TuiAltScreen, VStack, visibleWidth, type Component, type Terminal, type TuiMouseEvent } from "@earendil-works/pi-tui";
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
    assert.ok(lines.length <= 24);
    assert.ok(!lines.some(line => line.includes("@@")));
    assert.equal(f.calls.reduce((sum, n) => sum + n, 0), 0);
    if (count === 0) assert.ok(lines.some(line => line.includes("No se observaron cambios")));
    else assert.ok(lines.some(line => line.includes("▸ file-0.ts [modificado]") && /\+1\s*\/\s*-1/.test(line)));
    if (count > 2_000) {
      p.handleInput("\x1b[F");
      assert.ok(p.render(100).some(line => line.includes("Lista truncada: 2000/2500")));
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
  assert.match(text, /new\.ts \[creado\] \+2\s*\/\s*-0/);
  assert.match(text, /old\.ts \[eliminado\] \+0\s*\/\s*-4/);
  assert.ok(text.includes("binary.dat [modificado] [estadísticas no disponibles]"));
  assert.ok(text.includes("Diff no disponible: archivo binario."));
});

test("independent expansions preserve state across same key, focus, invalidate and width changes", () => {
  const f = files(3);
  const p = panel().panel;
  p.setView(view(f.files));
  p.handleInput("\r");
  p.handleInput("]");
  p.handleInput("\r");
  assert.ok(p.render(100).some(line => line.includes("▾ file-0")));
  assert.ok(p.render(100).some(line => line.includes("▾ file-1")));
  assert.ok(p.render(100).some(line => line.includes("▸ file-2")));
  assert.equal(f.calls[2], 0);
  p.focused = true;
  p.focused = false;
  p.invalidate();
  p.render(8);
  p.setView(view(f.files));
  assert.equal(p.render(100).filter(line => line.includes("▾ file-")).length, 2);
  p.handleInput("[");
  p.handleInput("\r");
  assert.ok(p.render(100).some(line => line.includes("▸ file-0")));
  assert.ok(p.render(100).some(line => line.includes("▾ file-1")));
  p.setView(view(f.files, "iteration-2"));
  assert.equal(p.render(100).filter(line => line.includes("▸ file-")).length, 3);
  assert.ok(p.render(100)[1]!.startsWith("│>"));
});

test("keyboard file/hunk navigation and Enter; only editor/close controls, no feedback", () => {
  const f = files(2);
  const state = panel();
  const p = state.panel;
  p.setView(view(f.files));
  p.handleInput("\r");
  p.handleInput("}");
  assert.ok(p.render(100).some(line => line.startsWith("│>") && line.includes("@@")));
  p.handleInput("{"); // No earlier hunk: remains stable.
  p.handleInput("\x1b[A");
  p.handleInput("\r");
  assert.ok(p.render(100).some(line => line.includes("▸ file-0")));
  p.handleInput("\x1b[B");
  p.handleInput("\r");
  assert.ok(p.render(100).some(line => line.includes("▾ file-1")));
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
  assert.equal(p.handleMouse(mouse("press", 1))?.focus, true);
  p.handleMouse(mouse("release", 1));
  p.handleMouse(mouse("click", 1));
  assert.ok(p.render(100).some(line => line.includes("▾ file-0")));
  p.handleMouse(mouse("click", 5));
  assert.ok(p.render(100).some(line => line.includes("▾ file-1")));
  p.handleMouse(mouse("wheel", 3, 8));
  assert.ok(!p.render(100).some(line => line.includes("file-0.ts")));
  p.handleMouse(mouse("wheel", 3, -8));
  assert.ok(p.render(100).some(line => line.includes("▾ file-0")));
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
  assert.ok(p.render(120).some(line => line.includes("límite global de 12000")));
  p.handleInput("\x1b[H");
  p.handleInput("]");
  p.handleInput("\x1b[A");
  assert.ok(p.render(160).some(line => line.includes("Diff truncado: 2000/100000")));
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
    assert.ok(lines.every(line => !/[\x00-\x1f\x7f-\x9f\u202e]/.test(line.replaceAll("\x1b[0m", ""))));
    assert.ok(!lines.some(line => line.includes("https://evil")));
  }
  const text = p.render(100).join("\n");
  assert.ok(text.includes("café🙂 e\u0301    "));
  assert.match(text, /\s+1 \+ café/);
  assert.match(text, /1\s+- café/);
  assert.match(text, /2\s+2\s+café/);
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
    assert.ok(tui.getScreenLines().some(line => /│> ▸ file-[1-9]\d*\.ts/.test(line)), "Pi's global PageDown is routed to the dock cursor");
    terminal.input("\x1b[6~"); tui.renderNow(true);
    assert.equal(nativeScroll.scrollTop, nativeTop);
    terminal.input("\x1b[H"); tui.renderNow(true);
    terminal.input("\x1b[<65;140;4M"); tui.renderNow(true);
    assert.ok(!tui.getScreenLines().some(line => line.includes("file-0.ts")));
    assert.equal(nativeScroll.scrollTop, nativeTop);
    terminal.input("\x1b[5~"); terminal.input("\x1b[H"); tui.renderNow(true);
    terminal.input("\x1b[<0;140;2M"); terminal.input("\x1b[<0;140;2m"); tui.renderNow(true);
    assert.ok(tui.getScreenLines().some(line => line.includes("▾ file-0.ts")));
    for (const height of [1, 2, 3]) {
      terminal.rows = height; terminal.resize(); tui.renderNow(true);
      assert.equal(tui.getScreenLines().length, height);
      assert.ok(tui.getScreenLines().every(line => visibleWidth(line) <= terminal.columns));
    }
    terminal.rows = 15; terminal.resize(); tui.renderNow(true);
    assert.ok(tui.getScreenLines().some(line => line.includes("▾ file-0.ts")));
    terminal.input("\x1b"); terminal.input("!");
    assert.equal(draft, "native draft!");
  } finally { dock.close(); tui.stop(); }
});

test("34-column headers keep status and exact counts when the path is long", () => {
  const p = panel().panel;
  p.setView(view([{
    path: "src/a-very-long-directory/long-name.ts", kind: "modified", added: 123, removed: 45,
    getRows: () => { throw new Error("collapsed file content was requested"); },
  }]));
  const header = p.render(34)[1]!;
  assert.ok(header.includes("[modificado]"));
  assert.match(header, /\+123\s*\/\s*-45/);
  assert.ok(visibleWidth(header) <= 34);
});
