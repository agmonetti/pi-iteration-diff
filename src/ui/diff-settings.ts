import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import {
  getKeybindings,
  matchesKey,
  truncateToWidth,
  type Component,
  type TUI,
  type TuiMouseEvent,
  type TuiMouseEventResult,
} from "@earendil-works/pi-tui";

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

export const SETTING_ITEMS = [
  { id: "dockWidth", label: "Dock width" },
  { id: "lineNumbers", label: "Line numbers" },
  { id: "filePaths", label: "File paths" },
  { id: "collapseFiles", label: "Collapse files by default" },
  { id: "rememberWidth", label: "Remember dock width" },
  { id: "autoOpen", label: "Auto-open after iteration" },
] as const;

export class DiffSettingsComponent implements Component {
  private settings: DiffSettings;
  private selectedIndex = 0;
  private isEditingDockWidth = false;
  private dockWidthBeforeEdit: number;

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    initialSettings: DiffSettings,
    private readonly onChange: (settings: DiffSettings) => void,
    private readonly onClose: () => void,
  ) {
    this.settings = { ...initialSettings };
    this.dockWidthBeforeEdit = initialSettings.dockWidth;
  }

  get isEditing(): boolean { return this.isEditingDockWidth; }
  get currentSelectedIndex(): number { return this.selectedIndex; }
  get currentSettings(): DiffSettings { return { ...this.settings }; }

  invalidate(): void {}

  render(width: number): string[] {
    const lines: string[] = [];
    const maxLabelWidth = 27;

    lines.push(truncateToWidth(this.theme.fg("accent", this.theme.bold("Diff Settings")), width));
    lines.push("");

    for (let i = 0; i < SETTING_ITEMS.length; i++) {
      const item = SETTING_ITEMS[i]!;
      const isSelected = this.selectedIndex === i;
      const prefix = isSelected ? this.theme.fg("accent", "→ ") : "  ";
      const labelPadded = item.label.padEnd(maxLabelWidth, " ");
      const labelStr = isSelected ? this.theme.fg("accent", labelPadded) : labelPadded;

      let valueStr: string;
      if (item.id === "dockWidth") {
        const rounded = Math.round(this.settings.dockWidth);
        if (isSelected && this.isEditingDockWidth) {
          valueStr = this.theme.fg("accent", this.theme.bold(`◀ ${rounded}% ▶`));
        } else {
          const raw = `${rounded}%`;
          valueStr = isSelected ? this.theme.fg("accent", raw) : this.theme.fg("muted", raw);
        }
      } else if (item.id === "lineNumbers") {
        const raw = this.settings.lineNumbers ? "On" : "Off";
        valueStr = isSelected ? this.theme.fg("accent", raw) : this.theme.fg("muted", raw);
      } else if (item.id === "filePaths") {
        const raw = this.settings.filePaths;
        valueStr = isSelected ? this.theme.fg("accent", raw) : this.theme.fg("muted", raw);
      } else if (item.id === "collapseFiles") {
        const raw = this.settings.collapseFiles ? "On" : "Off";
        valueStr = isSelected ? this.theme.fg("accent", raw) : this.theme.fg("muted", raw);
      } else if (item.id === "rememberWidth") {
        const raw = this.settings.rememberWidth ? "On" : "Off";
        valueStr = isSelected ? this.theme.fg("accent", raw) : this.theme.fg("muted", raw);
      } else {
        const raw = this.settings.autoOpen ? "On" : "Off";
        valueStr = isSelected ? this.theme.fg("accent", raw) : this.theme.fg("muted", raw);
      }

      lines.push(truncateToWidth(`${prefix}${labelStr}  ${valueStr}`, width));
    }

    lines.push("");
    if (this.isEditingDockWidth) {
      lines.push(truncateToWidth(this.theme.fg("dim", "  ←/→: adjust (30%–60%) · Enter: confirm · Esc: cancel"), width));
    } else {
      lines.push(truncateToWidth(this.theme.fg("dim", "  Saved in this session branch · ↑/↓: navigate · Enter: edit/toggle · Esc: close"), width));
    }

    return lines;
  }

  handleInput(data: string): void {
    const kb = getKeybindings();

    if (this.isEditingDockWidth) {
      if (kb.matches(data, "tui.select.confirm") || matchesKey(data, "enter")) {
        this.isEditingDockWidth = false;
        this.tui.requestRender();
        return;
      }
      if (kb.matches(data, "tui.select.cancel") || matchesKey(data, "escape")) {
        if (this.settings.dockWidth !== this.dockWidthBeforeEdit) {
          this.settings = { ...this.settings, dockWidth: this.dockWidthBeforeEdit };
          this.onChange(this.settings);
        }
        this.isEditingDockWidth = false;
        this.tui.requestRender();
        return;
      }
      if (matchesKey(data, "left") || data === "h") {
        if (this.settings.dockWidth > 30) {
          const next = Math.max(30, Math.round(this.settings.dockWidth - 1));
          this.settings = { ...this.settings, dockWidth: next };
          this.onChange(this.settings);
          this.tui.requestRender();
        }
        return;
      }
      if (matchesKey(data, "right") || data === "l") {
        if (this.settings.dockWidth < 60) {
          const next = Math.min(60, Math.round(this.settings.dockWidth + 1));
          this.settings = { ...this.settings, dockWidth: next };
          this.onChange(this.settings);
          this.tui.requestRender();
        }
        return;
      }
      return;
    }

    // Outside edit mode
    if (kb.matches(data, "tui.select.cancel") || matchesKey(data, "escape")) {
      this.onClose();
      return;
    }

    if (kb.matches(data, "tui.select.up") || matchesKey(data, "up") || data === "k") {
      this.selectedIndex = this.selectedIndex === 0 ? SETTING_ITEMS.length - 1 : this.selectedIndex - 1;
      this.tui.requestRender();
      return;
    }

    if (kb.matches(data, "tui.select.down") || matchesKey(data, "down") || data === "j") {
      this.selectedIndex = this.selectedIndex === SETTING_ITEMS.length - 1 ? 0 : this.selectedIndex + 1;
      this.tui.requestRender();
      return;
    }

    if (kb.matches(data, "tui.select.confirm") || matchesKey(data, "enter") || data === " ") {
      if (this.selectedIndex === 0) {
        this.isEditingDockWidth = true;
        this.dockWidthBeforeEdit = this.settings.dockWidth;
        this.tui.requestRender();
        return;
      }
      if (this.selectedIndex === 1) {
        this.settings = { ...this.settings, lineNumbers: !this.settings.lineNumbers };
        this.onChange(this.settings);
        this.tui.requestRender();
        return;
      }
      if (this.selectedIndex === 2) {
        const modes: DiffSettings["filePaths"][] = ["Smart", "Full", "Filename"];
        const nextIdx = (modes.indexOf(this.settings.filePaths) + 1) % modes.length;
        this.settings = { ...this.settings, filePaths: modes[nextIdx]! };
        this.onChange(this.settings);
        this.tui.requestRender();
        return;
      }
      if (this.selectedIndex === 3) {
        this.settings = { ...this.settings, collapseFiles: !this.settings.collapseFiles };
        this.onChange(this.settings);
        this.tui.requestRender();
        return;
      }
      if (this.selectedIndex === 4) {
        this.settings = { ...this.settings, rememberWidth: !this.settings.rememberWidth };
        this.onChange(this.settings);
        this.tui.requestRender();
        return;
      }
      if (this.selectedIndex === 5) {
        this.settings = { ...this.settings, autoOpen: !this.settings.autoOpen };
        this.onChange(this.settings);
        this.tui.requestRender();
        return;
      }
      return;
    }

    // Left / right arrows for non-dockWidth items
    if (matchesKey(data, "left") || matchesKey(data, "right")) {
      const isRight = matchesKey(data, "right");
      if (this.selectedIndex === 1) {
        this.settings = { ...this.settings, lineNumbers: !this.settings.lineNumbers };
        this.onChange(this.settings);
        this.tui.requestRender();
        return;
      }
      if (this.selectedIndex === 2) {
        const modes: DiffSettings["filePaths"][] = ["Smart", "Full", "Filename"];
        const currentIdx = modes.indexOf(this.settings.filePaths);
        const nextIdx = (currentIdx + (isRight ? 1 : -1) + modes.length) % modes.length;
        this.settings = { ...this.settings, filePaths: modes[nextIdx]! };
        this.onChange(this.settings);
        this.tui.requestRender();
        return;
      }
      if (this.selectedIndex === 3) {
        this.settings = { ...this.settings, collapseFiles: !this.settings.collapseFiles };
        this.onChange(this.settings);
        this.tui.requestRender();
        return;
      }
      if (this.selectedIndex === 4) {
        this.settings = { ...this.settings, rememberWidth: !this.settings.rememberWidth };
        this.onChange(this.settings);
        this.tui.requestRender();
        return;
      }
      if (this.selectedIndex === 5) {
        this.settings = { ...this.settings, autoOpen: !this.settings.autoOpen };
        this.onChange(this.settings);
        this.tui.requestRender();
        return;
      }
    }
  }

  handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
    if (event.type === "click" && event.button === "left") {
      const itemIndex = event.y - 2;
      if (itemIndex >= 0 && itemIndex < SETTING_ITEMS.length) {
        if (this.isEditingDockWidth && itemIndex !== 0) {
          this.isEditingDockWidth = false;
        }
        this.selectedIndex = itemIndex;
        if (itemIndex === 0) {
          this.isEditingDockWidth = !this.isEditingDockWidth;
          if (this.isEditingDockWidth) {
            this.dockWidthBeforeEdit = this.settings.dockWidth;
          }
        } else {
          this.handleInput(" ");
        }
        this.tui.requestRender();
        return { handled: true };
      }
    }
    return undefined;
  }
}

export async function showDiffSettings(
  ctx: ExtensionContext,
  settings: DiffSettings,
  change: (settings: DiffSettings) => void,
): Promise<void> {
  if (ctx.mode !== "tui") {
    ctx.ui.notify("Diff settings require Pi TUI", "warning");
    return;
  }
  await ctx.ui.custom<void>((tui, theme, _keys, done) => {
    return new DiffSettingsComponent(tui, theme, settings, change, () => done());
  });
}
