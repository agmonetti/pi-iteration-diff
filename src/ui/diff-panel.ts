import {
  matchesKey, ScrollView, sliceByColumn, stripTerminalSequences, truncateToWidth, visibleWidth, VStack,
  type Component, type Focusable, type TuiMouseEvent, type TuiMouseEventResult,
} from "@earendil-works/pi-tui";
import type { DiffFile, DiffRow, IterationView } from "../diffs/iteration-diff.js";

const MAX_FILES = 2_000;
const MAX_FILE_ROWS = 2_000;
const MAX_CONTENT_ROWS = 12_000;
const MAX_NOTICES = 32;
const MAX_TEXT_LENGTH = 16_384;
export type Role = "accent" | "muted" | "added" | "removed" | "dim" | "border" | "text" | "bold" | "warning";
export type Actions = {
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
    .replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, "");
}

/** Smart middle truncation for file paths preserving filename and extension. */
export function truncatePath(path: string, maxLength: number): string {
  if (path.length <= maxLength) return path;
  if (maxLength <= 5) return path.slice(-maxLength);
  const parts = path.split("/");
  if (parts.length <= 1) {
    const extIdx = path.lastIndexOf(".");
    const ext = extIdx > 0 ? path.slice(extIdx) : "";
    const name = extIdx > 0 ? path.slice(0, extIdx) : path;
    const avail = maxLength - 1 - ext.length;
    if (avail > 2) return `${name.slice(0, avail)}…${ext}`;
    return `…${path.slice(-(maxLength - 1))}`;
  }
  const filename = parts[parts.length - 1]!;
  const firstDir = parts[0]!;
  const target = `${firstDir}/…/${filename}`;
  if (target.length <= maxLength) {
    let current = target;
    for (let i = 1; i < parts.length - 1; i++) {
      const candidate = `${parts.slice(0, i + 1).join("/")}/…/${filename}`;
      if (candidate.length <= maxLength) current = candidate;
      else break;
    }
    return current;
  }
  if (maxLength >= filename.length + 2) {
    return `…/${filename}`;
  }
  return `…${filename.slice(-(maxLength - 1))}`;
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
  private panX = 0;
  private inspecting = false;

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
      this.panX = 0;
      this.inspecting = false;
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
    const rawTitle = safeText(this.view.title);
    const title = rawTitle.toUpperCase().startsWith("DIFF") ? rawTitle : `DIFF: ${rawTitle}`;
    const scopeTag = width >= 42 ? " [Last*]" : "";
    const text = truncateToWidth(`│ ${title}${scopeTag}`, width, "…");
    return this.actions.style(this.focused ? "accent" : "muted", text);
  }
  private footer(width: number): string {
    const active = this.diffEntries[this.cursor];
    if (this.inspecting && active) {
      const detail = active.kind === "file"
        ? active.file.path
        : active.kind === "row"
        ? active.row.text
        : active.text;
      const text = truncateToWidth(`│ i: ${safeText(detail)}`, width, "…");
      return this.actions.style("accent", text);
    }
    const short = width < 45;
    const panStr = this.panX > 0 ? ` [pan +${this.panX}]` : "";
    const text = short
      ? `Enter: abrir${panStr} · Esc: editor · q: cerrar`
      : `Enter/clic: abrir${panStr} · ↑↓: navegar · ←→: pan · Esc: editor · q: cerrar`;
    return this.actions.style("muted", truncateToWidth(`│ ${text}`, width, "…"));
  }
  private entryLine(index: number, width: number): string {
    const entry = this.diffEntries[index];
    if (!entry) return "";
    const active = index === this.cursor;
    const border = this.actions.style("border", "│");
    const cursor = active ? (this.focused ? this.actions.style("accent", ">") : this.actions.style("dim", ">")) : " ";
    const prefix = `${border}${cursor} `;

    if (entry.kind === "file") {
      const { file } = entry;
      const kind = { created: "creado", modified: "modificado", deleted: "eliminado" }[file.kind];
      const chevron = this.expanded.has(file.path) ? "▾" : "▸";
      if (file.added !== undefined && file.removed !== undefined) {
        const kindBadge = `[${kind}]`;
        const kindStyled = this.actions.style("muted", kindBadge);
        const addStr = this.actions.style("added", `+${file.added}`);
        const sepStr = this.actions.style("dim", " / ");
        const delStr = this.actions.style("removed", `-${file.removed}`);

        const markerPlain = `│${active ? ">" : " "} ${chevron} `;
        const suffixPlain = ` ${kindBadge} +${file.added} / -${file.removed}`;
        const avail = Math.max(4, width - visibleWidth(markerPlain) - visibleWidth(suffixPlain));
        const path = truncatePath(safeText(file.path), avail);
        const nameWithChevron = this.actions.style("bold", `${chevron} ${path}`);

        const line = `${prefix}${nameWithChevron} ${kindStyled} ${addStr}${sepStr}${delStr}`;
        return truncateToWidth(line, Math.max(0, width), "…");
      }
      const statMsg = "[estadísticas no disponibles]";
      const kindBadge = `[${kind}]`;
      const kindStyled = this.actions.style("muted", kindBadge);
      const nameWithChevron = this.actions.style("bold", `${chevron} ${safeText(file.path)}`);
      const text = `${nameWithChevron} ${kindStyled} ${this.actions.style("dim", statMsg)}${file.notice ? ` · ${this.actions.style("warning", safeText(file.notice))}` : ""}`;
      const line = `${prefix}${text}`;
      return truncateToWidth(line, Math.max(0, width), "…");
    }

    if (entry.kind === "notice") {
      const line = `${prefix}${this.actions.style("muted", safeText(entry.text))}`;
      return truncateToWidth(line, Math.max(0, width), "…");
    }

    // Row kind
    const { row } = entry;
    if (row.kind === "hunk" || row.kind === "notice") {
      const line = `${prefix}${this.actions.style("muted", safeText(row.text))}`;
      return truncateToWidth(line, Math.max(0, width), "…");
    }

    // Code row
    const old = row.oldLine === undefined ? "" : String(row.oldLine);
    const next = row.newLine === undefined ? "" : String(row.newLine);
    const mark = row.kind === "added" ? "+" : row.kind === "removed" ? "-" : " ";

    const numStr = this.actions.style("dim", `${old.padStart(4)} ${next.padStart(4)}`);
    const markStr = row.kind === "added" ? this.actions.style("added", mark)
      : row.kind === "removed" ? this.actions.style("removed", mark)
      : mark;

    const rawCode = safeText(row.text);
    let codePart = rawCode;
    let panIndicator = " ";
    if (this.panX > 0) {
      codePart = sliceByColumn(rawCode, this.panX, Number.MAX_SAFE_INTEGER);
      panIndicator = "«";
    }
    const panStyled = this.panX > 0 ? this.actions.style("dim", panIndicator) : " ";
    const codeStyled = row.kind === "added" ? this.actions.style("added", codePart)
      : row.kind === "removed" ? this.actions.style("removed", codePart)
      : this.actions.style("text", codePart);

    const line = `${prefix}${numStr} ${markStr}${panStyled}${codeStyled}`;
    return truncateToWidth(line, Math.max(0, width), "…");
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
    if (data === "i") { this.inspecting = !this.inspecting; this.actions.render(); return; }
    if (matchesKey(data, "enter")) this.toggle();
    else if (matchesKey(data, "down")) this.cursor++;
    else if (matchesKey(data, "up")) this.cursor--;
    else if (matchesKey(data, "right") || data === "l") { this.panX += 8; this.actions.render(); return; }
    else if (matchesKey(data, "left") || data === "h") { this.panX = Math.max(0, this.panX - 8); this.actions.render(); return; }
    else if (matchesKey(data, "pageDown")) this.cursor += Math.max(1, this.body.viewportHeight - 1);
    else if (matchesKey(data, "pageUp")) this.cursor -= Math.max(1, this.body.viewportHeight - 1);
    else if (matchesKey(data, "home") || data === "0") { this.cursor = 0; this.panX = 0; }
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
