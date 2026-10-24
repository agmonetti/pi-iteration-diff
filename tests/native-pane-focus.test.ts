import assert from "node:assert/strict";
import { test } from "node:test";
import { Container, ScrollView, TuiAltScreen, VStack, type Component, type Terminal } from "@earendil-works/pi-tui";
import { mountDock, type DockHandle } from "../src/ui/layout-adapter.js";
import { DiffPanel } from "../src/ui/diff-panel.js";

class TestTerminal implements Terminal {
  columns = 120;
  rows = 24;
  kittyProtocolActive = false;
  input: (data: string) => void = () => {};
  start(input: (data: string) => void): void { this.input = input; }
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

function fixture() {
  const terminal = new TestTerminal();
  const links: string[] = [];
  const copies: string[] = [];
  const tui = new TuiAltScreen(terminal, false, undefined, {
    openUrl: url => links.push(url),
    copyOnSelect: false,
    copySelection: async text => { copies.push(text); return true; },
  });
  let draft = "existing draft";
  let submissions = 0;
  let editorPresses = 0;
  const editor: Component = {
    invalidate() {}, render: () => [draft],
    handleInput(data) { if (data === "\r") submissions++; else draft += data; },
    handleMouse(event) {
      if (event.type !== "press" || event.button !== "left") return;
      editorPresses++;
      return { handled: true, focus: true };
    },
  };
  const components = Array.from({ length: 7 }, () => new Container());
  components[0]!.addChild({ invalidate() {}, render: () => [
    "native conversation", "\x1b]8;;https://example.com\x1b\\native link\x1b]8;;\x1b\\",
    ...Array.from({ length: 40 }, (_, i) => `message ${i}`),
  ] });
  components[4]!.addChild(editor);
  components.forEach(child => tui.addChild(child));
  const transcript = new ScrollView(components[0]!, { primary: true });
  tui.setLayoutRoot(new VStack([
    { component: transcript, basis: 0, grow: 1 }, new VStack(components.slice(1)),
  ]));
  tui.setFocus(editor);
  let dock: DockHandle;
  const panel = new DiffPanel({
    render: () => tui.requestRender(), editor: () => dock.focusEditor(), close: () => dock.close(),
    setDockWidth: cols => dock.setDockWidth(cols), style: (_role, text) => text,
  });
  panel.setView({ key: "focus-test", title: "DIFF", notices: [], files: [{
    path: "fixture.ts", kind: "modified", added: 1, removed: 1,
    getRows: () => [{ kind: "hunk", text: "@@ -1 +1 @@" },
      { kind: "removed", text: "old", oldLine: 1 }, { kind: "added", text: "new", newLine: 1 }],
  }] });
  dock = mountDock(tui, panel);
  // Set an explicit width so the test is independent of session-persistent dock ratios.
  dock.setDockWidth(54);
  tui.start();
  tui.renderNow(true);
  const mouse = (button: number, x: number, y: number, release = false): void =>
    terminal.input(`\x1b[<${button};${x};${y}${release ? "m" : "M"}`);
  const click = (x: number, y: number): void => { mouse(0, x, y); mouse(0, x, y, true); };
  return { tui, terminal, editor, panel, dock, transcript, copies, links, mouse, click,
    draft: () => draft, submissions: () => submissions, editorPresses: () => editorPresses,
    close() { dock.close(); tui.stop(); } };
}

test("native transcript, message, blank space and editor clicks return focus without changing draft or diff selection", () => {
  const f = fixture();
  try {
    f.dock.focusPanel();
    f.terminal.input("\r");
    f.terminal.input("\x1b[B");
    f.terminal.input("\x1b[1;2B");
    const selection = Array.from({ length: 8 }, (_, i) => f.panel.isIndexSelected(i));
    assert.ok(selection.some(Boolean));
    for (const [x, y] of [[3, 1], [3, 8], [60, 10], [3, 24]]) {
      f.dock.focusPanel();
      f.tui.renderNow(true);
      f.click(x!, y!);
      assert.equal(f.tui.getFocusedComponent(), f.editor);
      assert.deepEqual(Array.from({ length: 8 }, (_, i) => f.panel.isIndexSelected(i)), selection);
    }
    assert.equal(f.editorPresses(), 1);
    f.click(90, 1);
    assert.equal(f.tui.getFocusedComponent(), f.panel);
    assert.equal(f.draft(), "existing draft");
    assert.equal(f.submissions(), 0);
  } finally { f.close(); }
});

test("native text selection and OSC 8 links retain renderer fallback processing", async () => {
  const f = fixture();
  try {
    f.dock.focusPanel();
    f.mouse(0, 1, 1);
    f.mouse(32, 6, 1);
    f.mouse(0, 6, 1, true);
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    assert.ok(f.tui.hasActiveSelection());
    assert.equal(await f.tui.copyActiveSelectionToClipboard(), true);
    assert.deepEqual(f.copies, ["native"]);
    f.dock.focusPanel();
    f.tui.renderNow(true);
    assert.ok(f.tui.hasActiveSelection());
    f.click(3, 2);
    assert.deepEqual(f.links, ["https://example.com"]);
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    assert.equal(f.draft(), "existing draft");
    assert.equal(f.submissions(), 0);
  } finally { f.close(); }
});

test("wheel, motion, orphan drag, release and non-left presses do not steal focus", () => {
  const f = fixture();
  try {
    f.dock.focusPanel();
    for (const button of [65, 64, 35, 32, 1, 2]) {
      f.mouse(button, 3, 5);
      f.mouse(button, 3, 5, true);
      assert.equal(f.tui.getFocusedComponent(), f.panel);
    }
    f.mouse(65, 3, 5);
    assert.ok(f.transcript.scrollTop > 0);
    assert.equal(f.draft(), "existing draft");
    assert.equal(f.submissions(), 0);
  } finally { f.close(); }
});

test("captured separator resize and diff drag crossing into Pi do not invoke native focus", () => {
  const f = fixture();
  try {
    f.dock.focusPanel();
    f.mouse(0, 67, 5);
    f.mouse(32, 50, 5);
    f.mouse(0, 50, 5, true);
    assert.equal(f.dock.getDockWidth(), 71);
    assert.equal(f.tui.getFocusedComponent(), f.panel);
    f.dock.setDockWidth(54);
    f.tui.renderNow(true);
    f.terminal.input("\r");
    f.tui.renderNow(true);
    f.mouse(0, 90, 5);
    f.mouse(32, 3, 6);
    f.mouse(0, 3, 6, true);
    assert.equal(f.tui.getFocusedComponent(), f.panel);
    f.click(3, 6);
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    assert.equal(f.draft(), "existing draft");
    assert.equal(f.submissions(), 0);
  } finally { f.close(); }
});
