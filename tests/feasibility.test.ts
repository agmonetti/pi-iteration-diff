import assert from "node:assert/strict";
import { test } from "node:test";
import { Container, ScrollView, TuiAltScreen, TuiMainScreen, VStack, visibleWidth, matchesKey,
  type Terminal, type Component } from "@earendil-works/pi-tui";
import { mountDock, type DockHandle } from "../src/ui/layout-adapter.js";
import { DiffPanel } from "../src/ui/diff-panel.js";

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
  components[0]!.addChild({ invalidate() {}, render: () => ["native conversation"] });
  components[4]!.addChild(editor);
  components.forEach(child => tui.addChild(child));
  const native = new VStack([
    { component: new ScrollView(components[0]!, { primary: true, follow: "end" }), basis: 0, grow: 1 },
    new VStack(components.slice(1)),
  ]);
  tui.setLayoutRoot(native);
  tui.setFocus(editor);
  let dock: DockHandle | undefined;
  const panel = new DiffPanel({
    render: () => tui.requestRender(),
    editor: () => dock?.focusEditor(),
    close: () => dock?.close(),
    style: (role, text) => role === "accent" ? `\x1b[36m${text}\x1b[39m` : text,
  });
  panel.setView({ key: "fixture-iteration", title: "DIFF: iteración", notices: [], files: [{
    path: "fixture.ts", kind: "modified", added: 1, removed: 1,
    getRows: () => [{ kind: "hunk", text: "@@ -1 +1 @@" },
      { kind: "removed", text: "old", oldLine: 1 }, { kind: "added", text: "café 🙂 e\u0301", newLine: 1 }],
  }] });
  return { terminal, tui, native, panel, editor, draft: () => draft,
    mount() { dock = mountDock(tui, panel); return dock; } };
}

test("real TUI dock preserves native rendering, focus and draft; restore is idempotent", () => {
  const f = fixture();
  const dock = f.mount();
  f.tui.start();
  try {
    f.tui.renderNow(true);
    assert.ok(f.tui.getScreenLines().some(line => line.includes("DIFF: iteración")));
    assert.ok(f.tui.getScreenLines().some(line => line.includes("native conversation")));
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    f.terminal.input("!");
    dock.focusPanel();
    f.terminal.input("\r");
    f.tui.renderNow(true);
    assert.ok(f.tui.getScreenLines().some(line => line.includes("▾ fixture.ts")));
    f.terminal.input("a"); f.terminal.input("d");
    assert.equal(f.draft(), "existing draft!");
    f.terminal.input("\x1b");
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    dock.close(); dock.close();
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    f.tui.renderNow(true);
    assert.ok(!f.tui.getScreenLines().some(line => line.includes("DIFF: iteración")));
  } finally { dock.close(); f.tui.stop(); }
});

test("real fullscreen SGR header click expands exactly once without selection or editor transfer", () => {
  const f = fixture();
  const dock = f.mount();
  f.tui.start();
  try {
    f.tui.renderNow(true);
    f.terminal.input("\x1b[<0;90;2M");
    f.terminal.input("\x1b[<0;90;2m");
    f.tui.renderNow(true);
    assert.ok(f.tui.getScreenLines().some(line => line.includes("▾ fixture.ts")));
    assert.equal(f.tui.getFocusedComponent(), f.panel);
    assert.equal(f.draft(), "existing draft");
    f.terminal.input("\x1b[<0;90;2M");
    f.terminal.input("\x1b[<0;90;2m");
    f.tui.renderNow(true);
    assert.ok(f.tui.getScreenLines().some(line => line.includes("▸ fixture.ts")));
  } finally { dock.close(); f.tui.stop(); }
  assert.ok(f.terminal.output.includes("\x1b[?1006l"));
});

test("resize hides narrow dock, restores editor focus and keeps expansions and Unicode widths", () => {
  const f = fixture();
  const dock = f.mount();
  f.tui.start();
  try {
    f.tui.renderNow(true);
    dock.focusPanel();
    f.terminal.input("\r");
    f.terminal.columns = 45;
    f.terminal.resize(); f.tui.renderNow(true);
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    assert.ok(!f.tui.getScreenLines().some(line => line.includes("DIFF: iteración")));
    for (const width of [1, 8, 34]) assert.ok(f.panel.render(width).every(line => visibleWidth(line) <= width));
    f.terminal.columns = 120;
    f.terminal.resize(); f.tui.renderNow(true);
    assert.ok(f.tui.getScreenLines().some(line => line.includes("▾ fixture.ts")));
    assert.equal(f.draft(), "existing draft");
  } finally { dock.close(); f.tui.stop(); }
});

test("focus heading follows F6, Esc, header and editor mouse clicks without resetting expansion", () => {
  const f = fixture();
  const dock = f.mount();
  const unsubscribe = f.tui.addInputListener(data => {
    if (!matchesKey(data, "f6")) return;
    dock.focusPanel();
    return { consume: true };
  });
  const highlighted = (): boolean => {
    f.tui.renderNow(true);
    assert.equal(f.panel.focused, f.tui.getFocusedComponent() === f.panel);
    return f.tui.getScreenLines().some(line => line.includes("\x1b[36m│ DIFF"));
  };
  f.tui.start();
  try {
    assert.equal(highlighted(), false);
    f.terminal.input("\x1b[17~");
    assert.equal(highlighted(), true);
    f.terminal.input("\r");
    f.terminal.input("\x1b");
    assert.equal(highlighted(), false);
    f.terminal.input("\x1b[<0;90;1M");
    f.terminal.input("\x1b[<0;90;1m");
    assert.equal(highlighted(), true);
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
    assert.ok(f.tui.getScreenLines().some(line => line.includes("▾ fixture.ts")));
    assert.equal(f.draft(), "existing draft");
    dock.close();
    assert.equal(f.panel.focused, false);
  } finally { unsubscribe(); dock.close(); f.tui.stop(); }
});

test("unknown ownership and regular mode are rejected; cleanup never clobbers a later owner", () => {
  const f = fixture();
  const dock = f.mount();
  assert.throws(() => mountDock(f.tui, f.panel), /ocupado/);
  const foreign = new Container();
  foreign.addChild({ invalidate() {}, render: () => ["foreign owner"] });
  f.tui.setLayoutRoot(foreign);
  dock.close();
  assert.deepEqual(f.tui.render(120), ["foreign owner"]);
  assert.throws(() => mountDock(f.tui, f.panel), /ocupado/);
  assert.throws(() => mountDock(new TuiMainScreen(new TestTerminal()), f.panel), /fullscreen/);
});
