import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SETTINGS, parseSettings, restoreSettings, SETTINGS_ENTRY } from "../src/ui/diff-settings.js";
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
