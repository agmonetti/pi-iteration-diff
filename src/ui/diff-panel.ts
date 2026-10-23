import {
  matchesKey, ScrollView, stripTerminalSequences, truncateToWidth, visibleWidth, VStack,
  type Component, type Focusable, type TuiMouseEvent, type TuiMouseEventResult,
} from "@earendil-works/pi-tui";
import type { DiffFile, DiffRow, IterationView } from "../diffs/iteration-diff.js";

const MAX_FILES = 2_000;
const MAX_FILE_ROWS = 2_000;
const MAX_CONTENT_ROWS = 12_000;
const MAX_NOTICES = 32;
const MAX_TEXT_LENGTH = 16_384;
type Role = "accent" | "muted" | "added" | "removed";
type Actions = {
  render(): void;
  editor(): void;
  close(): void;
  style(role: Role, text: string): string;
};
type Entry = { kind: "file"; file: DiffFile } | { kind: "row"; row: DiffRow } |
  { kind: "notice"; text: string };

// Pi exposes this shape through VStack, not through the package entry exports.
interface PanelMouseDispatch extends TuiMouseEventResult {
  handled: true;
  target: { component: Component; originX: number; originY: number; width: number; height: number };
}

/** All workspace strings are untrusted terminal data, never ANSI markup. */
function safeText(text: string): string {
  const bounded = text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}… [texto truncado]` : text;
  return stripTerminalSequences(bounded).replaceAll("\t", "    ")
    .replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, "�");
}

/** Pi lays out the scroll child before providing its actual allocated viewport.
 * Keep a bounded sparse line array and hydrate only the visible cells after
 * updateLayout. The same array is retained by Pi's layout frame, so even the
 * first frame and a resize use the current viewport, not terminal guesses.
 */
class VirtualDiffScroll extends ScrollView {
  private lines: string[] = [];
  private width = 1;
  constructor(private readonly count: () => number, private readonly line: (index: number, width: number) => string) {
    let owner: VirtualDiffScroll;
    const content: Component = {
      invalidate() {},
      render(width) { return owner.prepare(width); },
    };
    super(content, { follow: "none", overscroll: "contain", scrollbar: "hidden" });
    owner = this;
  }
  private prepare(width: number): string[] {
    this.width = width;
    this.lines = new Array<string>(this.count());
    return this.lines;
  }
  override updateLayout(contentHeight: number, viewportHeight: number, requestRender: () => void): void {
    super.updateLayout(contentHeight, viewportHeight, requestRender);
    const end = Math.min(this.lines.length, this.scrollTop + this.viewportHeight);
    for (let row = this.scrollTop; row < end; row++) this.lines[row] = this.line(row, this.width);
  }
  visible(width: number): string[] {
    const height = this.viewportHeight || 22;
    return Array.from({ length: Math.min(height, Math.max(0, this.count() - this.scrollTop)) },
      (_, offset) => this.line(this.scrollTop + offset, width));
  }
}

/** Read-only M2 explorer. Expansion state belongs to one captured iteration. */
export class DiffPanel extends VStack implements Component, Focusable {
  private view: IterationView = { key: "", title: "DIFF", notices: [], files: [] };
  private readonly expanded = new Set<string>();
  private diffEntries: Entry[] = [];
  private cursor = 0;
  private hasFocus = false;
  private readonly body: VirtualDiffScroll;
  private pressed = false;

  constructor(private readonly actions: Actions) {
    super();
    this.body = new VirtualDiffScroll(() => this.diffEntries.length, (index, width) => this.entryLine(index, width));
    this.addChild({ invalidate() {}, render: width => [this.heading(width)] }, { basis: 1, shrink: 1, minSize: 0 });
    this.addChild(this.body, { basis: 0, grow: 1, shrink: 1, minSize: 0 });
    this.addChild({ invalidate() {}, render: width => [this.footer(width)] }, { basis: 1, shrink: 1, minSize: 0 });
    this.rebuild();
  }

  get focused(): boolean { return this.hasFocus; }
  set focused(value: boolean) {
    if (value === this.hasFocus) return;
    this.hasFocus = value;
    this.actions.render();
  }

  setView(view: IterationView): void {
    const reset = this.view.key !== view.key;
    this.view = view;
    if (reset) {
      this.expanded.clear();
      this.cursor = 0;
      this.body.scrollToStart();
      this.pressed = false;
    }
    this.rebuild();
    if (reset && view.files.length) this.cursor = Math.max(0, this.diffEntries.findIndex(entry => entry.kind === "file"));
    this.actions.render();
  }

  private rebuild(): void {
    const entries: Entry[] = [];
    for (const text of this.view.notices.slice(0, MAX_NOTICES)) entries.push({ kind: "notice", text });
    if (this.view.notices.length > MAX_NOTICES) entries.push({ kind: "notice", text: "Avisos adicionales omitidos por límite de vista." });
    let remaining = MAX_CONTENT_ROWS;
    for (const file of this.view.files.slice(0, MAX_FILES)) {
      entries.push({ kind: "file", file });
      if (!this.expanded.has(file.path)) continue;
      if (file.notice) entries.push({ kind: "notice", text: file.notice });
      if (remaining === 0) {
        entries.push({ kind: "notice", text: `Contenido omitido: límite global de ${MAX_CONTENT_ROWS} filas. Contraé otros archivos.` });
        continue;
      }
      const rows = file.getRows();
      const count = Math.min(rows.length, MAX_FILE_ROWS, remaining);
      for (let index = 0; index < count; index++) entries.push({ kind: "row", row: rows[index]! });
      remaining -= count;
      if (count < rows.length) entries.push({ kind: "notice", text: `Diff truncado: ${count}/${rows.length} filas (máximo ${MAX_FILE_ROWS}/archivo y ${MAX_CONTENT_ROWS} global).` });
    }
    if (this.view.files.length > MAX_FILES) entries.push({ kind: "notice", text: `Lista truncada: ${MAX_FILES}/${this.view.files.length} archivos.` });
    if (entries.length === 0) entries.push({ kind: "notice", text: "No se observaron cambios en esta iteración." });
    this.diffEntries = entries;
    this.cursor = Math.min(this.cursor, entries.length - 1);
    // Update scroll bounds immediately, without waiting for another Pi frame.
    this.body.updateLayout(entries.length, this.body.viewportHeight, () => this.actions.render());
  }

  private heading(width: number): string {
    const text = truncateToWidth(`│ DIFF: ${safeText(this.view.title)}`, width, "…");
    return this.actions.style(this.focused ? "accent" : "muted", text);
  }
  private footer(width: number): string {
    const short = width < 45;
    const text = short
      ? "Enter: abrir · Esc: editor · q: cerrar"
      : "Enter/clic: abrir · ↑↓: navegar · Esc: editor · q: cerrar";
    return this.actions.style("muted", truncateToWidth(`│ ${text}`, width, "…"));
  }
  private entryLine(index: number, width: number): string {
    const entry = this.diffEntries[index];
    if (!entry) return "";
    const prefix = `│${index === this.cursor ? ">" : " "} `;
    let text: string;
    let role: Role | undefined;
    if (entry.kind === "file") {
      const { file } = entry;
      const kind = { created: "creado", modified: "modificado", deleted: "eliminado" }[file.kind];
      if (file.added !== undefined && file.removed !== undefined) {
        const marker = `${prefix}${this.expanded.has(file.path) ? "▾" : "▸"} `;
        const suffix = ` [${kind}] +${file.added} / -${file.removed}`;
        const available = Math.max(0, width - visibleWidth(marker) - visibleWidth(suffix));
        const path = truncateToWidth(safeText(file.path), available, "…");
        return truncateToWidth(`${marker}${path}${suffix}`, Math.max(0, width), "…");
      }
      text = `${this.expanded.has(file.path) ? "▾" : "▸"} ${safeText(file.path)} [${kind}] [estadísticas no disponibles]${file.notice ? ` · ${safeText(file.notice)}` : ""}`;
    } else if (entry.kind === "notice") {
      text = safeText(entry.text);
      role = "muted";
    } else {
      const { row } = entry;
      if (row.kind === "hunk" || row.kind === "notice") {
        text = safeText(row.text);
        role = "muted";
      } else {
        const old = row.oldLine === undefined ? "" : String(row.oldLine);
        const next = row.newLine === undefined ? "" : String(row.newLine);
        const mark = row.kind === "added" ? "+" : row.kind === "removed" ? "-" : " ";
        text = `${old.padStart(4)} ${next.padStart(4)} ${mark} ${safeText(row.text)}`;
        if (row.kind === "added" || row.kind === "removed") role = row.kind;
      }
    }
    const line = truncateToWidth(`${prefix}${text}`, Math.max(0, width), "…");
    return role ? this.actions.style(role, line) : line;
  }

  override render(width: number): string[] {
    if (width <= 0) return [];
    return [this.heading(width), ...this.body.visible(width), this.footer(width)];
  }

  private reveal(): void {
    const height = Math.max(1, this.body.viewportHeight || 22);
    if (this.cursor < this.body.scrollTop) this.body.scrollTo(this.cursor);
    else if (this.cursor >= this.body.scrollTop + height) this.body.scrollTo(this.cursor - height + 1);
  }
  private toggle(): void {
    const entry = this.diffEntries[this.cursor];
    if (entry?.kind !== "file") return;
    const path = entry.file.path;
    if (!this.expanded.delete(path)) this.expanded.add(path);
    this.rebuild();
    this.reveal();
  }
  private jump(direction: number, kind: "file" | "hunk"): void {
    for (let index = this.cursor + direction; index >= 0 && index < this.diffEntries.length; index += direction) {
      const entry = this.diffEntries[index]!;
      if ((kind === "file" && entry.kind === "file") || (kind === "hunk" && entry.kind === "row" && entry.row.kind === "hunk")) {
        this.cursor = index;
        return;
      }
    }
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "tab")) { this.actions.editor(); return; }
    if (data === "q") { this.actions.close(); return; }
    if (matchesKey(data, "enter")) this.toggle();
    else if (matchesKey(data, "down")) this.cursor++;
    else if (matchesKey(data, "up")) this.cursor--;
    else if (matchesKey(data, "pageDown")) this.cursor += Math.max(1, this.body.viewportHeight - 1);
    else if (matchesKey(data, "pageUp")) this.cursor -= Math.max(1, this.body.viewportHeight - 1);
    else if (matchesKey(data, "home")) this.cursor = 0;
    else if (matchesKey(data, "end")) this.cursor = this.diffEntries.length - 1;
    else if (data === "]" || data === "[") this.jump(data === "]" ? 1 : -1, "file");
    else if (data === "}" || data === "{") this.jump(data === "}" ? 1 : -1, "hunk");
    else return;
    this.cursor = Math.max(0, Math.min(this.diffEntries.length - 1, this.cursor));
    this.reveal();
    this.actions.render();
  }

  /** Route Pi's fullscreen paging/line shortcuts without touching its transcript. */
  scrollBy(lines: number): void {
    if (!Number.isFinite(lines)) return;
    const step = Math.trunc(lines);
    this.cursor = Math.max(0, Math.min(this.diffEntries.length - 1, this.cursor + step));
    this.body.scrollBy(step);
    this.reveal();
    this.actions.render();
  }

  override handleMouse(event: TuiMouseEvent): PanelMouseDispatch | undefined {
    const result = {
      handled: true as const,
      target: {
        component: this,
        originX: event.screenX - event.x,
        originY: event.screenY - event.y,
        width: event.width,
        height: event.height,
      },
    };
    if (event.type === "wheel") {
      this.body.scrollBy(event.wheelDelta ?? 0);
      return { ...result, render: true };
    }
    if (event.type === "release") return { ...result, render: false };
    if (event.button !== "left" || (event.type !== "press" && event.type !== "click")) return;
    // Pi synthesizes a click after a handled press/release. Never toggle twice.
    if (event.type === "click" && this.pressed) { this.pressed = false; return { ...result, render: false }; }
    this.pressed = event.type === "press";
    if (event.y > 0 && event.y < event.height - 1) {
      this.cursor = Math.max(0, Math.min(this.diffEntries.length - 1, this.body.scrollTop + event.y - 1));
      this.toggle();
    }
    return { ...result, focus: true, render: true };
  }
}
