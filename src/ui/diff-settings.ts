import { getSettingsListTheme, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, SettingsList, Text, type SettingItem } from "@earendil-works/pi-tui";

export interface DiffSettings {
  dockWidth: number;
  lineNumbers: boolean;
  filePaths: "Smart" | "Full" | "Filename";
  collapseFiles: boolean;
  rememberWidth: boolean;
  autoOpen: boolean;
}
export const SETTINGS_ENTRY = "iteration-diff-settings";
export const DEFAULT_SETTINGS: Readonly<DiffSettings> = {
  dockWidth: 45, lineNumbers: true, filePaths: "Smart", collapseFiles: true,
  rememberWidth: true, autoOpen: false,
};

/** Invalid or future payloads cannot grant automatic-opening consent. */
export function parseSettings(data: unknown): DiffSettings | undefined {
  if (!data || typeof data !== "object") return;
  const d = data as Record<string, unknown>;
  if (d.version !== 1 || typeof d.dockWidth !== "number" || !Number.isFinite(d.dockWidth) ||
      d.dockWidth < 30 || d.dockWidth > 60 ||
      typeof d.lineNumbers !== "boolean" || typeof d.collapseFiles !== "boolean" ||
      typeof d.rememberWidth !== "boolean" || typeof d.autoOpen !== "boolean" ||
      typeof d.filePaths !== "string" || !["Smart", "Full", "Filename"].includes(d.filePaths)) return;
  return { dockWidth: d.dockWidth, lineNumbers: d.lineNumbers,
    filePaths: d.filePaths as DiffSettings["filePaths"], collapseFiles: d.collapseFiles,
    rememberWidth: d.rememberWidth, autoOpen: d.autoOpen };
}

export function restoreSettings(entries: readonly { type: string; customType?: string; data?: unknown }[]): DiffSettings {
  let settings = { ...DEFAULT_SETTINGS };
  for (const entry of entries) {
    if (entry.type === "custom" && entry.customType === SETTINGS_ENTRY) {
      settings = parseSettings(entry.data) ?? { ...DEFAULT_SETTINGS };
    }
  }
  return settings;
}

export async function showDiffSettings(ctx: ExtensionContext, settings: DiffSettings,
  change: (settings: DiffSettings) => void): Promise<void> {
  if (ctx.mode !== "tui") { ctx.ui.notify("Diff settings require Pi TUI", "warning"); return; }
  await ctx.ui.custom<void>((tui, theme, _keys, done) => {
    const toggle = (id: keyof DiffSettings, label: string): SettingItem => ({ id, label,
      currentValue: settings[id] ? "On" : "Off", values: ["Off", "On"] });
    const items: SettingItem[] = [
      { id: "dockWidth", label: "Dock width", currentValue: `${Math.round(settings.dockWidth)}%`,
        values: Array.from({ length: 31 }, (_, i) => `${i + 30}%`) },
      toggle("lineNumbers", "Line numbers"),
      { id: "filePaths", label: "File paths", currentValue: settings.filePaths, values: ["Smart", "Full", "Filename"] },
      toggle("collapseFiles", "Collapse files by default"),
      toggle("rememberWidth", "Remember dock width"),
      toggle("autoOpen", "Auto-open after iteration"),
    ];
    const list = new SettingsList(items, 6, getSettingsListTheme(), (id, value) => {
      const next = parseSettings({ ...settings, version: 1,
        [id]: id === "dockWidth" ? Number(value.slice(0, -1)) : id === "filePaths" ? value : value === "On" });
      if (next) { settings = next; change(next); }
    }, () => done());
    const container = new Container();
    container.addChild(new Text(theme.fg("accent", "Diff Settings"), 0, 0));
    container.addChild(list);
    container.addChild(new Text(theme.fg("dim", "Saved in this session branch · Esc: close"), 0, 0));
    return { render: width => container.render(width), invalidate: () => container.invalidate(),
      handleInput(data) { list.handleInput(data); tui.requestRender(); } };
  }, { overlay: true });
}
