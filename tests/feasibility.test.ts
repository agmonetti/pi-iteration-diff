import assert from "node:assert/strict";
import { test } from "node:test";
import { Container, ScrollView, TuiAltScreen, TuiMainScreen, VStack, visibleWidth, matchesKey,
  type Terminal, type Component } from "@earendil-works/pi-tui";
import { mountDock } from "../src/ui/layout-adapter.js";
import { appendExcerpt, FeasibilityPanel } from "../src/ui/feasibility-panel.js";

class TestTerminal implements Terminal {
  columns = 120;
  rows = 24;
  kittyProtocolActive = false;
  output = "";
  input: (data: string) => void = () => {};
  resize: () => void = () => {};
  start(input: (data: string) => void, resize: () => void): void { this.input = input; this.resize = resize; }
  stop(): void {}
  async drainInput(): Promise<void> {}
  write(data: string): void { this.output += data; }
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

function fixture() {
  const terminal = new TestTerminal();
  const tui = new TuiAltScreen(terminal);
  let draft = "existing draft";
  const editor: Component = {
    invalidate() {}, render: () => [draft], handleInput(data) { draft += data; },
    handleMouse: () => ({ handled: true, focus: true }),
  };
  const components = Array.from({ length: 7 }, () => new Container());
  components[0].addChild({ invalidate() {}, render: () => ["native conversation"] });
  components[4].addChild(editor);
  components.forEach((child) => tui.addChild(child));
  const native = new VStack([
    { component: new ScrollView(components[0], { primary: true, follow: "end" }), basis: 0, grow: 1 },
    new VStack(components.slice(1)),
  ]);
  tui.setLayoutRoot(native);
  tui.setFocus(editor);
  const panel = new FeasibilityPanel({
    render: () => tui.requestRender(),
    append: (start, end) => { draft = appendExcerpt(draft, start, end); },
    editor: () => tui.setFocus(editor),
    highlight: (text) => `\x1b[36m${text}\x1b[39m`,
  });
  return { terminal, tui, native, panel, editor, draft: () => draft };
}

test("real TUI: side dock preserves native rendering, focus, draft and idempotent restore", () => {
  const f = fixture();
  const dock = mountDock(f.tui, f.panel);
  f.tui.start();
  try {
    f.tui.renderNow(true);
    assert.ok(f.tui.getScreenLines().some((line) => line.includes("M0 SYNTHETIC")));
    assert.ok(f.tui.getScreenLines().some((line) => line.includes("native conversation")));
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    f.terminal.input("!");
    dock.focusPanel();
    f.terminal.input("\x1b[1;2B");
    assert.deepEqual(f.panel.range(), [0, 1]);
    f.terminal.input("a");
    f.terminal.input("a");
    assert.ok(f.draft().startsWith("existing draft!\n\n"));
    assert.equal(f.draft().split("[M0 synthetic").length, 3);
    f.terminal.input("\x1b");
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    dock.close(); dock.close();
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    f.tui.renderNow(true);
    assert.ok(!f.tui.getScreenLines().some((line) => line.includes("M0 SYNTHETIC")));
  } finally { dock.close(); f.tui.stop(); }
});

test("real fullscreen routing: SGR press/drag/release captured across panel boundary", () => {
  const f = fixture();
  const dock = mountDock(f.tui, f.panel);
  f.tui.start();
  try {
    f.tui.renderNow(true);
    f.terminal.input("\x1b[<0;90;4M");
    f.terminal.input("\x1b[<32;90;6M");
    f.terminal.input("\x1b[<0;10;6m");
    assert.deepEqual(f.panel.range(), [0, 2]);
    assert.equal(f.panel.lastDrop, "received outside panel");
    assert.equal(f.tui.getFocusedComponent(), f.panel);
    assert.equal(f.draft(), "existing draft");
    // Release ended capture: a new press starts a fresh range.
    f.terminal.input("\x1b[<0;90;5M");
    f.terminal.input("\x1b[<0;90;5m");
    assert.deepEqual(f.panel.range(), [1, 1]);
  } finally { dock.close(); f.tui.stop(); }
  assert.ok(f.terminal.output.includes("\x1b[?1006l"));
});

test("resize: hide panel at narrow width, restore editor focus, respect ANSI/Unicode cell widths", () => {
  const f = fixture();
  const dock = mountDock(f.tui, f.panel);
  f.tui.start();
  try {
    dock.focusPanel();
    f.terminal.columns = 45;
    f.terminal.resize(); f.tui.renderNow(true);
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    assert.ok(!f.tui.getScreenLines().some((line) => line.includes("M0 SYNTHETIC")));
    for (const width of [1, 8, 34]) {
      assert.ok(f.panel.render(width).every((line) => visibleWidth(line) <= width));
    }
    f.terminal.columns = 120;
    f.terminal.resize(); f.tui.renderNow(true);
    assert.ok(f.tui.getScreenLines().some((line) => line.includes("M0 SYNTHETIC")));
  } finally { dock.close(); f.tui.stop(); }
});

test("focus heading follows F6, Esc, mouse and resize without changing selection or draft", () => {
  const f = fixture();
  const dock = mountDock(f.tui, f.panel);
  // Same public input hook used by /m0-diff; no native editor modifications.
  const unsubscribe = f.tui.addInputListener(data => {
    if (!matchesKey(data, "f6")) return;
    dock.focusPanel();
    return { consume: true };
  });
  const highlighted = (): boolean => {
    f.tui.renderNow(true);
    assert.equal(f.panel.focused, f.tui.getFocusedComponent() === f.panel);
    return f.tui.getScreenLines().some(line => line.includes("\x1b[36m│ M0 SYNTHETIC"));
  };
  f.tui.start();
  try {
    assert.equal(highlighted(), false);
    f.terminal.input("\x1b[17~"); // F6
    assert.equal(highlighted(), true);
    f.terminal.input("\x1b");
    assert.equal(highlighted(), false);
    f.terminal.input("\x1b[<0;90;4M");
    f.terminal.input("\x1b[<0;90;4m");
    assert.equal(highlighted(), true);
    // Editor is on the final row of the native viewport.
    f.terminal.input("\x1b[<0;3;24M");
    f.terminal.input("\x1b[<0;3;24m");
    assert.equal(highlighted(), false);
    f.terminal.input("\x1b[17~");
    assert.equal(highlighted(), true);
    f.terminal.columns = 80;
    f.terminal.resize();
    assert.equal(highlighted(), false);
    f.terminal.columns = 120;
    f.terminal.resize();
    assert.equal(highlighted(), false);
    assert.deepEqual(f.panel.range(), [0, 0]);
    assert.equal(f.draft(), "existing draft");
    dock.close();
    assert.equal(f.panel.focused, false);
  } finally { unsubscribe(); dock.close(); f.tui.stop(); }
});

test("unknown ownership and regular mode are rejected; cleanup never clobbers a later owner", () => {
  const f = fixture();
  const dock = mountDock(f.tui, f.panel);
  assert.throws(() => mountDock(f.tui, f.panel), /ocupado/);
  const foreign = new Container();
  foreign.addChild({ invalidate() {}, render: () => ["foreign owner"] });
  f.tui.setLayoutRoot(foreign);
  dock.close();
  assert.deepEqual(f.tui.render(120), ["foreign owner"]);
  assert.throws(() => mountDock(f.tui, f.panel), /ocupado/);
  assert.throws(() => mountDock(new TuiMainScreen(new TestTerminal()), f.panel), /fullscreen/);
});

test("append preserves literal draft, selection order, tabs and Unicode", () => {
  assert.equal(appendExcerpt("", 1, 1), "[M0 synthetic fixture.txt | new | 2-2 | DISCUSS]\n\treturn café;");
  const draft = "  user\n🙂\n";
  assert.ok(appendExcerpt(draft, 0, 2).startsWith(draft + "\n\n"));
});
