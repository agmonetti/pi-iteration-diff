import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, ScrollView, TuiAltScreen, VStack, stripTerminalSequences,
  type Component, type TUI, type Terminal } from "@earendil-works/pi-tui";
import { mountDock, ResizableDockRoot, type DockHandle } from "../src/ui/layout-adapter.js";
import { DiffPanel } from "../src/ui/diff-panel.js";
import { DEFAULT_SETTINGS, DiffSettingsComponent, parseSettings, type DiffSettings } from "../src/ui/diff-settings.js";
import { DOCK_WIDTH_FILE, loadDockWidth, saveDockWidth } from "../src/ui/dock-width-store.js";

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

function fixture(initialMaximized: boolean) {
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
  }, { maximized: initialMaximized });
  panel.setView({ key: "fixture-iteration", title: "DIFF: iteración", notices: [], files: [{
    path: "fixture.ts", kind: "modified", added: 1, removed: 1,
    getRows: () => [{ kind: "hunk", text: "@@ -1 +1 @@" },
      { kind: "removed", text: "old", oldLine: 1 }, { kind: "added", text: "new", newLine: 1 }],
  }] });
  return { terminal, tui, panel, editor, draft: () => draft,
    mount() { dock = mountDock(tui, panel, 0.45, initialMaximized); return dock; } };
}

test("enabled maximized fills the view while the dock holds focus and restores the native layout on Esc", () => {
  const f = fixture(true);
  const dock = f.mount();
  f.tui.start();
  try {
    f.tui.renderNow(true);
    assert.ok(f.tui.getScreenLines().some(line => line.includes("native conversation")),
      "opening with editor focus keeps the normal layout");
    assert.equal(dock.getDockWidth(), 54);
    dock.focusPanel();
    f.tui.renderNow(true);
    assert.ok(!f.tui.getScreenLines().some(line => line.includes("native conversation")),
      "maximized hides the native column");
    const heading = f.tui.getScreenLines().map(stripTerminalSequences)
      .find(line => line.includes("DIFF"));
    assert.ok(heading, "dock heading is rendered");
    assert.equal(heading.indexOf("▏"), 0, "maximized dock starts at the left edge");
    assert.ok(heading.indexOf("1 file") > 100, "heading count sits at the full-width right edge");
    assert.ok(f.tui.getScreenLines().some(line => stripTerminalSequences(line).includes("M fixture.ts")));
    assert.equal(dock.getDockWidth(), 120, "dock spans the full terminal width");
    assert.equal(dock.getDockRatio(), 0.45, "stored width survives maximized rendering");
    f.terminal.input("\x1b");
    f.tui.renderNow(true);
    assert.ok(f.tui.getScreenLines().some(line => line.includes("native conversation")),
      "Esc closes the dock and restores the full Pi layout");
    assert.ok(!f.tui.getScreenLines().some(line => stripTerminalSequences(line).includes("DIFF")),
      "no diff panel remains after Esc");
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    assert.equal(f.draft(), "existing draft");
  } finally { dock.close(); f.tui.stop(); }
});

test("with maximized disabled Esc keeps the side dock open and returns focus to the editor", () => {
  const f = fixture(false);
  const dock = f.mount();
  f.tui.start();
  try {
    f.tui.renderNow(true);
    dock.focusPanel();
    f.tui.renderNow(true);
    f.terminal.input("\x1b");
    f.tui.renderNow(true);
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    assert.ok(f.tui.getScreenLines().some(line => stripTerminalSequences(line).includes("DIFF")),
      "classic side dock survives Esc");
    assert.equal(dock.getDockWidth(), 54);
    assert.equal(f.draft(), "existing draft");
  } finally { dock.close(); f.tui.stop(); }
});

test("narrow terminals keep the native fallback even with maximized enabled", () => {
  const f = fixture(true);
  const dock = f.mount();
  f.tui.start();
  try {
    dock.focusPanel();
    f.tui.renderNow(true);
    assert.ok(!f.tui.getScreenLines().some(line => line.includes("native conversation")));
    f.terminal.columns = 45;
    f.terminal.resize();
    f.tui.renderNow(true);
    assert.equal(f.tui.getFocusedComponent(), f.editor, "narrow resize restores editor focus");
    assert.ok(f.tui.getScreenLines().some(line => line.includes("native conversation")));
    f.terminal.columns = 120;
    f.terminal.resize();
    f.tui.renderNow(true);
    assert.equal(dock.getDockWidth(), 54, "editor focus keeps the stored dock width");
    assert.equal(f.draft(), "existing draft");
  } finally { dock.close(); f.tui.stop(); }
});

test("maximized applies only with panel focus and a visible width; resize keys stay inert while full", () => {
  const root = new ResizableDockRoot([
    { component: { invalidate() {}, render: () => [] }, basis: 0, grow: 1, minSize: 46 },
    { component: { invalidate() {}, render: () => [] }, basis: 54, minSize: 34 },
  ]);
  assert.equal(root.getDockWidth(120), 54);
  root.setMaximized(true);
  assert.equal(root.getDockWidth(120), 54, "maximized without panel focus changes nothing");
  assert.equal(root.getDockWidth(89), 40, "narrow width keeps the clamped fallback");
  root.panelFocused = () => true;
  assert.equal(root.getDockWidth(120), 120);
  assert.equal(root.getDockWidth(89), 40, "below 90 columns maximized never applies");
  root.resizeBy(10, 120);
  root.setDockWidth(60, 120);
  assert.equal(root.dockRatio, 0.45, "width edits are inert while maximized");
  root.setMaximized(false);
  assert.equal(root.getDockWidth(120), 54, "disabling restores the stored width");
});

test("settings payload accepts legacy files without maximized and rejects invalid values", () => {
  const base = { version: 1, dockWidth: 45, lineNumbers: true, filePaths: "Smart", collapseFiles: true,
    rememberWidth: true, autoOpen: false };
  assert.equal(parseSettings(base)?.maximized, false, "legacy branch entries default maximized to Off");
  assert.equal(parseSettings({ ...base, maximized: true })?.maximized, true);
  assert.equal(parseSettings({ ...base, maximized: "yes" }), undefined);
});

test("DiffSettingsComponent exposes Maximized full view with toggle and arrows", () => {
  let changed: DiffSettings | undefined;
  const tui = { requestRender() {} } as unknown as TUI;
  const theme = { fg: (_role: string, text: string) => text, bg: (_role: string, text: string) => text,
    bold: (text: string) => text } as unknown as Theme;
  const comp = new DiffSettingsComponent(tui, theme, DEFAULT_SETTINGS, next => { changed = next; }, () => {});
  for (let i = 0; i < 6; i++) comp.handleInput("\x1b[B");
  let lines = comp.render(80);
  assert.ok(lines.some(line => line.includes("Maximized full view") && line.includes("Off")));
  comp.handleInput("\r");
  assert.equal(changed?.maximized, true);
  lines = comp.render(80);
  assert.ok(lines.some(line => line.includes("Maximized full view") && line.includes("On")));
  comp.handleInput("\x1b[D");
  assert.equal(changed?.maximized, false, "left arrow toggles back");
});

test("global preferences persist maximized, accept legacy files and reject invalid values", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diff-maximized-store-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  try {
    saveDockWidth({ dockWidth: 50, rememberWidth: true, autoOpen: true, maximized: true, wrapLines: true });
    const loaded = loadDockWidth();
    assert.deepEqual(loaded.status === "ok" && loaded.value,
      { dockWidth: 50, rememberWidth: true, autoOpen: true, maximized: true, wrapLines: true });
    await writeFile(join(dir, DOCK_WIDTH_FILE),
      JSON.stringify({ version: 1, dockWidth: 40, rememberWidth: false }) + "\n", { encoding: "utf8" });
    const legacy = loadDockWidth();
    assert.equal(legacy.status, "ok");
    assert.equal(legacy.status === "ok" && legacy.value.maximized, undefined);
    assert.equal(legacy.status === "ok" && legacy.value.wrapLines, undefined);
    await writeFile(join(dir, DOCK_WIDTH_FILE),
      JSON.stringify({ version: 1, dockWidth: 40, rememberWidth: false, maximized: "yes" }) + "\n",
      { encoding: "utf8" });
    assert.equal(loadDockWidth().status, "invalid");
    await writeFile(join(dir, DOCK_WIDTH_FILE),
      JSON.stringify({ version: 1, dockWidth: 40, rememberWidth: false, wrapLines: "yes" }) + "\n",
      { encoding: "utf8" });
    assert.equal(loadDockWidth().status, "invalid");
  } finally {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    await rm(dir, { recursive: true, force: true });
  }
});
