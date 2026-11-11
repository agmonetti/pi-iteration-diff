import assert from "node:assert/strict";
import { test } from "node:test";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { stripTerminalSequences, visibleWidth, Container, ScrollView, TuiAltScreen, VStack,
  type Component, type TUI, type Terminal } from "@earendil-works/pi-tui";
import type { DiffRow } from "../src/diffs/iteration-diff.js";
import { mountDock, type DockHandle } from "../src/ui/layout-adapter.js";
import { DiffPanel, DEFAULT_DIFF_PREFERENCES } from "../src/ui/diff-panel.js";
import { DEFAULT_SETTINGS, DiffSettingsComponent, parseSettings, type DiffSettings } from "../src/ui/diff-settings.js";

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

const LONG = `print("Hello World! ${"x".repeat(120)}")`;

function fixture(input: DiffRow[], wrapLines = true) {
  const panel = new DiffPanel({
    render() {}, close() {}, editor() {},
    style: (_role, text) => `\x1b[32m${text}\x1b[39m`,
    appendContext() {},
  }, { wrapLines });
  const view = { key: "one", title: "DIFF", notices: [], files: [
    { path: "a.ts", kind: "modified" as const, added: 1, removed: 0, getRows: () => input },
  ] };
  panel.setView(view);
  panel.handleInput("\r"); // expand the file so its rows render
  return panel;
}

function plain(panel: DiffPanel, width = 60): string[] {
  return panel.render(width).map(stripTerminalSequences);
}

test("wrap off keeps one visual row per entry with overflow truncation", () => {
  const panel = fixture([{ kind: "added", newLine: 1, text: LONG }], false);
  const lines = plain(panel);
  assert.equal(lines.filter(line => line.includes("│")).length, 0, "no continuation markers");
  assert.ok(lines.some(line => line.includes("»")), "long row is truncated with the pan marker as before");
  assert.ok(!lines.some(line => line.includes(LONG.slice(40, 80))), "the tail is not visible");
  assert.equal(DEFAULT_DIFF_PREFERENCES.wrapLines, false, "wrap defaults to Off");
});

test("wrap on expands a long row into a head plus │ continuations holding the full text", () => {
  const panel = fixture([{ kind: "added", newLine: 1, text: LONG }]);
  const lines = plain(panel, 60);
  const continuations = lines.filter(line => line.includes("│"));
  // codeWidth(60) = 60 - 5 - (4+1) = 50 columns; 122 visible columns → 3 segments.
  assert.equal(continuations.length, 2, "one continuation per extra segment");
  const joined = lines.join("\n");
  assert.ok(joined.includes(`print("Hello World!`), "head segment keeps the statement start");
  assert.ok(joined.includes(LONG.slice(-6)), "the final segment shows the tail");
  assert.ok(!lines.some(line => line.includes("…")), "nothing is truncated while wrapping");
  const marker = continuations[0]!;
  assert.equal(marker.indexOf("▏"), 0, "continuation keeps the panel border");
  assert.ok(marker.includes("    │ "), "blank number gutter with │ under the sign column");
});

test("wrapped rows honor Unicode columns: emoji, wide and combining characters never overflow", () => {
  const exotic = `${"🙂".repeat(12)} 界界界 e\u0301${"y".repeat(60)}`;
  const panel = fixture([{ kind: "removed", oldLine: 9, text: exotic }]);
  for (const width of [30, 47, 60, 80]) {
    const lines = plain(panel, width);
    assert.ok(lines.every(line => visibleWidth(line) <= width), `no row exceeds ${width} columns`);
    const joined = lines.join("\n");
    assert.ok(joined.includes("🙂🙂🙂"), "head segment renders");
    assert.ok(joined.includes("yyyy"), "continuations carry the remainder");
  }
});

test("toggling wrap lines via setPreferences re-expands and re-collapses in place", () => {
  const panel = fixture([{ kind: "added", newLine: 1, text: LONG }], false);
  assert.equal(plain(panel).filter(line => line.includes("│")).length, 0);
  panel.setPreferences({ wrapLines: true });
  const expanded = plain(panel);
  assert.equal(expanded.filter(line => line.includes("│")).length, 2);
  panel.setPreferences({ wrapLines: false });
  const collapsed = plain(panel);
  assert.equal(collapsed.filter(line => line.includes("│")).length, 0);
  assert.ok(collapsed.some(line => line.includes("»")));
});

test("cursor navigation and paging count wrapped segments as one logical entry", () => {
  const rows: DiffRow[] = [{ kind: "added", newLine: 1, text: LONG }];
  const panel = fixture(rows);
  panel.handleInput("\x1b[B"); // hunk
  panel.handleInput("\x1b[B"); // onto the wrapped row (head segment)
  const head = plain(panel).findIndex(line => line.startsWith("▏>"));
  assert.ok(head > 0, "cursor sits on the wrapped entry");
  // Selection anchored by clicking a continuation row must resolve to the entry.
  const event = { button: "left" as const, x: 10, screenX: 10, width: 60, height: 24,
    shift: false, alt: false, ctrl: false };
  const continuationY = plain(panel).findIndex(line => line.includes("│"));
  assert.ok(continuationY > head, "continuation renders below the head");
  panel.handleMouse({ ...event, type: "press", y: continuationY, screenY: continuationY });
  panel.handleMouse({ ...event, type: "click", y: continuationY, screenY: continuationY });
  assert.ok(panel.hasSelection(), "clicking a continuation selects the logical row");
  assert.ok(panel.formatSelectedContext()?.includes("Hello World!"), "full original text is appended");
});

test("pageDown/pageUp travel one viewport of display rows, not logical entries", () => {
  const rows: DiffRow[] = Array.from({ length: 6 }, (_, index) =>
    ({ kind: "added" as const, newLine: index + 1, text: `row${index} ${LONG}` }));
  // Mounted harness: only the real layout engine gives the body a viewport height.
  const terminal = new TestTerminal();
  const tui = new TuiAltScreen(terminal);
  let draft = "existing draft";
  const editor: Component = {
    invalidate() {}, render: () => [draft], handleInput(data) { draft += data; },
  };
  const components = Array.from({ length: 7 }, () => new Container());
  components[0]!.addChild({ invalidate() {}, render: () => ["native conversation"] });
  components[4]!.addChild(editor);
  components.forEach(child => tui.addChild(child));
  tui.setLayoutRoot(new VStack([
    { component: new ScrollView(components[0]!, { primary: true, follow: "end" }), basis: 0, grow: 1 },
    new VStack(components.slice(1)),
  ]));
  tui.setFocus(editor);
  const panel = fixture(rows);
  const dock = mountDock(tui, panel, 0.45, false);
  tui.start();
  try {
    dock.focusPanel();
    tui.renderNow(true);
    // At 54 dock columns codeWidth = 44; each `rowN` entry spans 4 display rows.
    // pageDown = one viewport of display rows (body height 20 → 19 rows), landing
    // on the entry that owns display row 19 — logical paging would overshoot to
    // the last entry instead.
    tui.getFocusedComponent()?.handleInput?.("\x1b[6~");
    tui.renderNow(true);
    const cursorLine = tui.getScreenLines().map(stripTerminalSequences).find(line => line.includes("▏>"));
    assert.ok(cursorLine?.includes("row4"), `pageDown lands on display row 19's owner, got: ${cursorLine}`);
    tui.getFocusedComponent()?.handleInput?.("\x1b[5~");
    tui.renderNow(true);
    const back = tui.getScreenLines().map(stripTerminalSequences).find(line => line.includes("▏>"));
    assert.ok(back?.includes("a.ts"), "pageUp returns to the file header");
  } finally { dock.close(); tui.stop(); }
});
test("horizontal pan is inert while wrapping and recovers after turning wrap off", () => {
  const panel = fixture([{ kind: "added", newLine: 1, text: LONG }]); // fixture expands the file
  panel.handleInput("\x1b[B"); panel.handleInput("\x1b[B"); // hunk, then the wrapped row
  panel.handleInput("l"); // pan right
  const lines = plain(panel);
  assert.ok(!lines.at(-1)?.includes("[pan"), "footer shows no pan while wrapping");
  assert.ok(!lines.some(line => line.includes("«") || line.includes("»")), "no pan markers while wrapping");
  panel.setPreferences({ wrapLines: false });
  panel.handleInput("l");
  const panned = plain(panel);
  assert.ok(panned.some(line => line.includes("«")), "pan resumes with wrap off");
});

test("settings payload and component expose Wrap long lines (per-branch, default Off)", () => {
  const data = { version: 1, ...DEFAULT_SETTINGS };
  assert.equal(parseSettings(data)?.wrapLines, false, "default Off");
  assert.equal(parseSettings({ ...data, wrapLines: true })?.wrapLines, true);
  assert.equal(parseSettings({ ...data, wrapLines: "yes" }), undefined);
  const legacy = { version: 1, dockWidth: 45, lineNumbers: true, filePaths: "Smart", collapseFiles: true,
    rememberWidth: true, autoOpen: false };
  assert.equal(parseSettings(legacy)?.wrapLines, false, "legacy payloads default to Off");

  let changed: DiffSettings | undefined;
  const tui = { requestRender() {} } as unknown as TUI;
  const theme = { fg: (_role: string, text: string) => text, bg: (_r: string, t: string) => t,
    bold: (text: string) => text } as unknown as Theme;
  const comp = new DiffSettingsComponent(tui, theme, DEFAULT_SETTINGS, next => { changed = next; }, () => {});
  const lines = comp.render(80).map(stripTerminalSequences);
  const item = lines.find(line => line.includes("Wrap long lines"));
  assert.ok(item, "Wrap long lines is listed");
  assert.ok(item!.includes("Off"), "shows the Off default");
  for (let i = 0; i < 7; i++) comp.handleInput("\x1b[B");
  assert.equal(comp.currentSelectedIndex, 7, "wrap item is the last entry");
  comp.handleInput("\r");
  assert.equal(changed?.wrapLines, true, "Enter toggles it On");
  comp.handleInput("\x1b[D");
  assert.equal(comp.currentSettings.wrapLines, false, "arrows toggle too");
});
