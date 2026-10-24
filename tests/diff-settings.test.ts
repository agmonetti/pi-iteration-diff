import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import {
  DEFAULT_SETTINGS,
  DiffSettingsComponent,
  parseSettings,
  restoreSettings,
  SETTINGS_ENTRY,
  showDiffSettings,
  type DiffSettings,
} from "../src/ui/diff-settings.js";
import { ResizableDockRoot } from "../src/ui/layout-adapter.js";
test("settings payload validates consent, finite widths, enums and version; branch restore fails closed", () => {
  const data = { version: 1, ...DEFAULT_SETTINGS };
  assert.deepEqual(parseSettings(data), DEFAULT_SETTINGS);
  for (const patch of [{ version: 2 }, { dockWidth: NaN }, { dockWidth: Infinity }, { dockWidth: 29 },
    { dockWidth: 61 }, { autoOpen: "On" }, { lineNumbers: null }, { filePaths: "unknown" }, { filePaths: ["Full"] }]) {
    assert.equal(parseSettings({ ...data, ...patch }), undefined);
  }
  const entry = (data: unknown) => ({ type: "custom", customType: SETTINGS_ENTRY, data });
  assert.equal(restoreSettings([entry({ ...data, autoOpen: true })]).autoOpen, true);
  assert.equal(restoreSettings([entry({ ...data, autoOpen: true }), entry({ version: 2 })]).autoOpen, false);
  assert.deepEqual(restoreSettings([]), DEFAULT_SETTINGS);
});

test("dock ratios are instance-scoped and clamp to 30–60%, retaining native minimum widths", () => {
  const a = new ResizableDockRoot([]);
  const b = new ResizableDockRoot([]);
  assert.equal(a.getDockWidth(120), 54);
  a.setDockWidth(1000, 200);
  assert.equal(a.dockRatio, 0.6);
  a.resizeBy(-1000, 200);
  assert.equal(a.dockRatio, 0.3);
  assert.equal(b.dockRatio, 0.45);
  a.dockRatio = NaN;
  assert.equal(a.dockRatio, 0.3);
  a.dockRatio = 0.6;
  assert.equal(a.getDockWidth(90), 44);
  assert.equal(a.getDockWidth(200), 120);
});

test("DiffSettingsComponent: arrow navigation, Dock width editing with limits, Enter/Esc in both modes", () => {
  let changed: DiffSettings | undefined;
  let closed = false;
  let renders = 0;
  const tui = { requestRender() { renders++; } } as unknown as TUI;
  const theme = {
    fg: (_role: string, text: string) => text,
    bg: (_role: string, text: string) => text,
    bold: (text: string) => text,
  } as unknown as Theme;

  const comp = new DiffSettingsComponent(tui, theme, DEFAULT_SETTINGS, next => { changed = next; }, () => { closed = true; });

  // 1. Initial state
  assert.equal(comp.currentSelectedIndex, 0);
  assert.equal(comp.isEditing, false);
  let lines = comp.render(80);
  assert.ok(lines.some(l => l.includes("→ Dock width") && l.includes("45%")));
  assert.ok(!lines.some(l => l.includes("◀ 45% ▶")));

  // 2. Navigation with down/up arrows
  comp.handleInput("\x1b[B"); // down
  assert.equal(comp.currentSelectedIndex, 1);
  comp.handleInput("\x1b[B"); // down
  assert.equal(comp.currentSelectedIndex, 2);
  comp.handleInput("\x1b[A"); // up
  assert.equal(comp.currentSelectedIndex, 1);
  comp.handleInput("\x1b[A"); // up to 0
  assert.equal(comp.currentSelectedIndex, 0);

  // 3. Enter on Dock width enters edit mode
  comp.handleInput("\r");
  assert.equal(comp.isEditing, true);
  lines = comp.render(80);
  // Shows discreet edit indicator
  assert.ok(lines.some(l => l.includes("◀ 45% ▶")));
  assert.ok(lines.some(l => l.includes("←/→: adjust (30%–60%) · Enter: confirm · Esc: cancel")));

  // 4. Arrow keys adjust in 1% steps
  comp.handleInput("\x1b[D"); // left arrow
  assert.equal(comp.currentSettings.dockWidth, 44);
  assert.equal(changed?.dockWidth, 44);

  comp.handleInput("\x1b[C"); // right arrow
  assert.equal(comp.currentSettings.dockWidth, 45);
  comp.handleInput("\x1b[C"); // right arrow
  assert.equal(comp.currentSettings.dockWidth, 46);

  // 5. Esc during edit cancels and restores previous value
  comp.handleInput("\x1b"); // escape
  assert.equal(comp.isEditing, false);
  assert.equal(comp.currentSettings.dockWidth, 45);
  assert.equal(changed?.dockWidth, 45);

  // 6. Enter edit mode again, adjust, and confirm with Enter
  comp.handleInput("\r");
  assert.equal(comp.isEditing, true);
  comp.handleInput("\x1b[C"); // right arrow to 46
  comp.handleInput("\x1b[C"); // right arrow to 47
  assert.equal(comp.currentSettings.dockWidth, 47);
  comp.handleInput("\r"); // enter confirms
  assert.equal(comp.isEditing, false);
  assert.equal(comp.currentSettings.dockWidth, 47);

  // 7. Clamp at 30% and 60%
  comp.handleInput("\r"); // enter edit mode
  for (let i = 0; i < 50; i++) comp.handleInput("\x1b[C"); // increase past 60
  assert.equal(comp.currentSettings.dockWidth, 60);
  for (let i = 0; i < 50; i++) comp.handleInput("\x1b[D"); // decrease past 30
  assert.equal(comp.currentSettings.dockWidth, 30);
  comp.handleInput("\r"); // confirm 30%
  assert.equal(comp.currentSettings.dockWidth, 30);

  // 8. Esc outside edit closes settings
  assert.equal(closed, false);
  comp.handleInput("\x1b");
  assert.equal(closed, true);
  assert.ok(renders > 0);
});

test("DiffSettingsComponent: boolean toggles and filePaths cycling without breaking", () => {
  let changed: DiffSettings | undefined;
  const tui = { requestRender() {} } as unknown as TUI;
  const theme = { fg: (_r: string, t: string) => t, bg: (_r: string, t: string) => t, bold: (t: string) => t } as unknown as Theme;
  const comp = new DiffSettingsComponent(tui, theme, DEFAULT_SETTINGS, next => { changed = next; }, () => {});

  // Line numbers (index 1)
  comp.handleInput("\x1b[B"); // down to lineNumbers
  comp.handleInput("\r"); // toggle Off
  assert.equal(comp.currentSettings.lineNumbers, false);
  assert.equal(changed?.lineNumbers, false);
  comp.handleInput("\r"); // toggle On
  assert.equal(comp.currentSettings.lineNumbers, true);

  // File paths (index 2)
  comp.handleInput("\x1b[B"); // down to filePaths
  assert.equal(comp.currentSettings.filePaths, "Smart");
  comp.handleInput("\r"); // cycle Full
  assert.equal(comp.currentSettings.filePaths, "Full");
  comp.handleInput("\r"); // cycle Filename
  assert.equal(comp.currentSettings.filePaths, "Filename");
  comp.handleInput("\r"); // cycle Smart
  assert.equal(comp.currentSettings.filePaths, "Smart");

  // Collapse files by default (index 3)
  comp.handleInput("\x1b[B");
  comp.handleInput("\r");
  assert.equal(comp.currentSettings.collapseFiles, false);

  // Remember dock width (index 4)
  comp.handleInput("\x1b[B");
  comp.handleInput("\r");
  assert.equal(comp.currentSettings.rememberWidth, false);

  // Auto-open (index 5)
  comp.handleInput("\x1b[B");
  comp.handleInput("\r");
  assert.equal(comp.currentSettings.autoOpen, true);
});

test("DiffSettingsComponent: mouse click selects items and toggles / edits", () => {
  const tui = { requestRender() {} } as unknown as TUI;
  const theme = { fg: (_r: string, t: string) => t, bg: (_r: string, t: string) => t, bold: (t: string) => t } as unknown as Theme;
  const comp = new DiffSettingsComponent(tui, theme, DEFAULT_SETTINGS, () => {}, () => {});

  // Click on Dock width (y = 2) toggles edit mode
  comp.handleMouse({ type: "click", button: "left", x: 5, y: 2, screenX: 5, screenY: 2, width: 80, height: 20, shift: false, alt: false, ctrl: false });
  assert.equal(comp.isEditing, true);

  // Click on Line numbers (y = 3) exits dock width edit and toggles line numbers
  comp.handleMouse({ type: "click", button: "left", x: 5, y: 3, screenX: 5, screenY: 3, width: 80, height: 20, shift: false, alt: false, ctrl: false });
  assert.equal(comp.isEditing, false);
  assert.equal(comp.currentSelectedIndex, 1);
  assert.equal(comp.currentSettings.lineNumbers, false);
});

test("showDiffSettings: renders inline without overlay option and handles close", async () => {
  let customOptions: Record<string, unknown> | undefined;
  let customComponent: Component | undefined;
  const theme = { fg: (_r: string, t: string) => t, bg: (_r: string, t: string) => t, bold: (t: string) => t } as unknown as Theme;
  const tui = { requestRender() {} } as unknown as TUI;
  const ctx = {
    mode: "tui",
    ui: {
      theme,
      async custom(factory: (tui: TUI, theme: Theme, keys: unknown, done: () => void) => Component, options?: Record<string, unknown>) {
        customOptions = options;
        customComponent = factory(tui, theme, {}, () => {});
      },
    },
  } as unknown as ExtensionContext;

  await showDiffSettings(ctx, DEFAULT_SETTINGS, () => {});
  // Crucial check: overlay must NOT be true (inline native rendering)
  assert.equal(customOptions?.overlay, undefined);
  assert.ok(customComponent instanceof DiffSettingsComponent);
  const lines = customComponent.render(80);
  assert.ok(lines.some(l => l.includes("Diff Settings")));
  assert.ok(lines.some(l => l.includes("Dock width")));
  assert.ok(lines.some(l => l.includes("Auto-open after iteration")));
});
