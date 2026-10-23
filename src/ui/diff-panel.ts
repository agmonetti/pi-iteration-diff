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

export type Role =
  | "accent"
  | "muted"
  | "added"
  | "removed"
  | "dim"
  | "border"
  | "text"
  | "bold"
  | "warning"
  | "selected"
  | "selectedBg";

export type Actions = {
  render(): void;
  editor(): void;
  close(): void;
  style(role: Role, text: string): string;
  resize?(deltaCols: number): void;
  setDockWidth?(cols: number): void;
  appendContext?(snippet: string): void;
};

export type Entry =
  | { kind: "file_header"; file: DiffFile }
  | { kind: "file_path"; file: DiffFile }
  | { kind: "hunk"; file: DiffFile; row: DiffRow; hunkIndex: number }
  | { kind: "row"; file: DiffFile; row: DiffRow; hunkIndex: number; rowIndex: number }
  | { kind: "notice"; text: string; file?: DiffFile };

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

/** Virtualized scroll rendering lines on demand. */
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

/** Definitive interactive DiffPanel with two-line file headers, unified diff, selection and context transfer. */
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

  // Selection state
  private selectionAnchor: number | null = null;
  private selectionFocus: number | null = null;
  private isDraggingSelection = false;
  private resizingSeparator = false;

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
      this.clearSelection();
      this.body.scrollToStart();
      this.pressed = false;
      this.resizingSeparator = false;
    }
    this.rebuild();
    if (reset && view.files.length) {
      this.cursor = Math.max(0, this.diffEntries.findIndex(entry => entry.kind === "file_header"));
    }
    this.actions.render();
  }

  private rebuild(): void {
    const entries: Entry[] = [];
    for (const text of this.view.notices.slice(0, MAX_NOTICES)) entries.push({ kind: "notice", text });
    if (this.view.notices.length > MAX_NOTICES) {
      entries.push({ kind: "notice", text: "Avisos adicionales omitidos por límite de vista." });
    }
    let remaining = MAX_CONTENT_ROWS;
    for (const file of this.view.files.slice(0, MAX_FILES)) {
      entries.push({ kind: "file_header", file });
      entries.push({ kind: "file_path", file });
      if (!this.expanded.has(file.path)) continue;
      if (file.notice) entries.push({ kind: "notice", text: file.notice, file });
      if (remaining === 0) {
        entries.push({ kind: "notice", text: `Contenido omitido: límite global de ${MAX_CONTENT_ROWS} filas. Contraé otros archivos.` });
        continue;
      }
      const rows = file.getRows();
      const count = Math.min(rows.length, MAX_FILE_ROWS, remaining);
      let currentHunk = 0;
      for (let index = 0; index < count; index++) {
        const row = rows[index]!;
        if (row.kind === "hunk") {
          currentHunk++;
          entries.push({ kind: "hunk", file, row, hunkIndex: currentHunk });
        } else {
          entries.push({ kind: "row", file, row, hunkIndex: currentHunk, rowIndex: index });
        }
      }
      remaining -= count;
      if (count < rows.length) {
        entries.push({ kind: "notice", text: `Diff truncado: ${count}/${rows.length} filas (máximo ${MAX_FILE_ROWS}/archivo y ${MAX_CONTENT_ROWS} global).` });
      }
    }
    if (this.view.files.length > MAX_FILES) {
      entries.push({ kind: "notice", text: `Lista truncada: ${MAX_FILES}/${this.view.files.length} archivos.` });
    }
    if (entries.length === 0) {
      entries.push({ kind: "notice", text: "No se observaron cambios en esta iteración." });
    }
    this.diffEntries = entries;
    this.cursor = Math.max(0, Math.min(this.cursor, entries.length - 1));
    this.body.updateLayout(entries.length, this.body.viewportHeight, () => this.actions.render());
  }

  // Selection helpers
  hasSelection(): boolean {
    return this.selectionAnchor !== null && this.selectionFocus !== null;
  }

  clearSelection(): void {
    this.selectionAnchor = null;
    this.selectionFocus = null;
    this.isDraggingSelection = false;
  }

  isIndexSelected(index: number): boolean {
    if (this.selectionAnchor === null || this.selectionFocus === null) return false;
    const start = Math.min(this.selectionAnchor, this.selectionFocus);
    const end = Math.max(this.selectionAnchor, this.selectionFocus);
    return index >= start && index <= end;
  }

  private getSelectedEntries(): Entry[] {
    if (!this.hasSelection()) {
      const active = this.diffEntries[this.cursor];
      return active ? [active] : [];
    }
    const start = Math.min(this.selectionAnchor!, this.selectionFocus!);
    const end = Math.max(this.selectionAnchor!, this.selectionFocus!);
    return this.diffEntries.slice(start, end + 1);
  }

  private selectHunkAt(index: number): void {
    const entry = this.diffEntries[index];
    if (!entry || (entry.kind !== "hunk" && entry.kind !== "row")) return;
    const targetHunk = entry.hunkIndex;
    const targetFile = entry.file.path;
    let first = -1;
    let last = -1;
    for (let i = 0; i < this.diffEntries.length; i++) {
      const e = this.diffEntries[i]!;
      if ((e.kind === "hunk" || e.kind === "row") && e.file.path === targetFile && e.hunkIndex === targetHunk) {
        if (first === -1) first = i;
        last = i;
      }
    }
    if (first !== -1 && last !== -1) {
      this.selectionAnchor = first;
      this.selectionFocus = last;
      this.cursor = last;
      this.reveal();
      this.actions.render();
    }
  }

  private getSelectionSummary(): string {
    const entries = this.getSelectedEntries();
    const rows = entries.filter((e): e is Entry & { kind: "row" } => e.kind === "row");
    if (!rows.length) return `${entries.length} ${entries.length === 1 ? "línea" : "líneas"}`;
    const oldNums = rows.map(r => r.row.oldLine).filter((n): n is number => n !== undefined);
    const newNums = rows.map(r => r.row.newLine).filter((n): n is number => n !== undefined);
    const parts: string[] = [];
    if (oldNums.length > 0) {
      const min = Math.min(...oldNums);
      const max = Math.max(...oldNums);
      parts.push(min === max ? `old:${min}` : `old:${min}-${max}`);
    }
    if (newNums.length > 0) {
      const min = Math.min(...newNums);
      const max = Math.max(...newNums);
      parts.push(min === max ? `new:${min}` : `new:${min}-${max}`);
    }
    const range = parts.join(", ");
    return `${range} (${rows.length} ${rows.length === 1 ? "línea" : "líneas"})`;
  }

  /** Format the selected context according to approved plain text diff format. */
  formatSelectedContext(): string | undefined {
    const entries = this.getSelectedEntries();
    // Group rows by file
    const fileMap = new Map<string, { file: DiffFile; hunkHeader?: string; rows: DiffRow[] }>();
    for (const entry of entries) {
      if (entry.kind === "hunk") {
        if (!fileMap.has(entry.file.path)) {
          fileMap.set(entry.file.path, { file: entry.file, rows: [] });
        }
        fileMap.get(entry.file.path)!.hunkHeader = entry.row.text;
      } else if (entry.kind === "row") {
        if (!fileMap.has(entry.file.path)) {
          fileMap.set(entry.file.path, { file: entry.file, rows: [] });
        }
        fileMap.get(entry.file.path)!.rows.push(entry.row);
      }
    }
    if (fileMap.size === 0) return undefined;

    const blocks: string[] = [];
    for (const { file, hunkHeader, rows } of fileMap.values()) {
      if (!rows.length) continue;
      const oldNums = rows.map(r => r.oldLine).filter((n): n is number => n !== undefined);
      const newNums = rows.map(r => r.newLine).filter((n): n is number => n !== undefined);
      const parts: string[] = [];
      if (oldNums.length > 0) {
        const min = Math.min(...oldNums);
        const max = Math.max(...oldNums);
        parts.push(min === max ? `old:${min}` : `old:${min}-${max}`);
      }
      if (newNums.length > 0) {
        const min = Math.min(...newNums);
        const max = Math.max(...newNums);
        parts.push(min === max ? `new:${min}` : `new:${min}-${max}`);
      }
      const rangeStr = parts.length > 0 ? ` | ${parts.join(" | ")}` : "";
      const headerLine = `[${file.path} | diff${rangeStr}]`;
      const codeLines: string[] = [];
      if (hunkHeader) codeLines.push(hunkHeader);
      for (const r of rows) {
        const prefix = r.kind === "added" ? "+" : r.kind === "removed" ? "-" : " ";
        codeLines.push(`${prefix}${r.text}`);
      }
      blocks.push(`${headerLine}\n${codeLines.join("\n")}`);
    }
    return blocks.length > 0 ? blocks.join("\n\n") : undefined;
  }

  private transferContext(): void {
    const formatted = this.formatSelectedContext();
    if (!formatted) return;
    this.actions.appendContext?.(formatted);
    this.actions.editor();
  }

  private heading(width: number): string {
    const rawTitle = safeText(this.view.title);
    if (rawTitle.toUpperCase().startsWith("DIFF:")) {
      return this.actions.style(this.focused ? "accent" : "muted", truncateToWidth(`│ ${rawTitle}`, width, "…"));
    }
    let scope = "Last iteration";
    const lower = rawTitle.toLowerCase();
    if (lower.includes("agrupada") || lower.includes("batch")) {
      scope = "Batch Net";
    } else if (lower.includes("interrumpida") || lower.includes("cancelada")) {
      scope = "Last iteration (interrumpida)";
    } else if (lower.includes("fallida") || lower.includes("falló")) {
      scope = "Last iteration (fallida)";
    } else if (lower.includes("parcial")) {
      scope = "Last iteration [parcial]";
    } else if (lower.includes("no disponible")) {
      scope = "No disponible";
    } else if (lower.includes("capturando")) {
      scope = "Capturando";
    }

    const fileCount = this.view.files.length;
    let titleContent: string;
    if (fileCount === 0) {
      titleContent = `DIFF · ${scope} · Sin cambios netos`;
    } else {
      const totalAdded = this.view.files.reduce((sum, f) => sum + (f.added ?? 0), 0);
      const totalRemoved = this.view.files.reduce((sum, f) => sum + (f.removed ?? 0), 0);
      const filesStr = `${fileCount} ${fileCount === 1 ? "file" : "files"}`;
      titleContent = `DIFF · ${scope} · ${filesStr} (+${totalAdded} / -${totalRemoved})`;
    }
    const text = truncateToWidth(`│ ${titleContent}`, width, "…");
    return this.actions.style(this.focused ? "accent" : "muted", text);
  }

  private footer(width: number): string {
    const active = this.diffEntries[this.cursor];
    if (this.inspecting && active) {
      const detail = active.kind === "file_header" || active.kind === "file_path"
        ? active.file.path
        : active.kind === "row" || active.kind === "hunk"
        ? active.row.text
        : active.text;
      const text = truncateToWidth(`│ i: ${safeText(detail)}`, width, "…");
      return this.actions.style("accent", text);
    }

    if (this.hasSelection()) {
      const summary = this.getSelectionSummary();
      const text = truncateToWidth(`│ Sel: ${summary} · a: anexa al editor`, width, "…");
      return this.actions.style("accent", text);
    }

    const short = width < 50;
    const panStr = this.panX > 0 ? ` [pan +${this.panX}]` : "";
    const text = short
      ? `Enter: abrir${panStr} · a: anexa · Esc: editor · q: cerrar`
      : `Enter/clic: toggle${panStr} · a: anexa · ↑↓: navegar · Esc: editor · q: cerrar`;
    return this.actions.style("muted", truncateToWidth(`│ ${text}`, width, "…"));
  }

  private entryLine(index: number, width: number): string {
    const entry = this.diffEntries[index];
    if (!entry) return "";
    const active = index === this.cursor;
    const selected = this.isIndexSelected(index);
    const border = this.actions.style("border", "│");
    const cursor = active ? (this.focused ? this.actions.style("accent", ">") : this.actions.style("dim", ">")) : " ";
    const prefix = `${border}${cursor} `;

    // 1. File Header (Line 1 of 2: Name, chevron, status badge, statistics)
    if (entry.kind === "file_header") {
      const { file } = entry;
      const kind = { created: "creado", modified: "modificado", deleted: "eliminado" }[file.kind];
      const chevron = this.expanded.has(file.path) ? "▾" : "▸";
      const parts = file.path.split("/");
      const basename = parts[parts.length - 1] || file.path;

      if (file.added !== undefined && file.removed !== undefined) {
        const kindBadge = `[${kind}]`;
        const kindStyled = this.actions.style("muted", kindBadge);
        const addStr = this.actions.style("added", `+${file.added}`);
        const sepStr = this.actions.style("dim", " / ");
        const delStr = this.actions.style("removed", `-${file.removed}`);

        const markerPlain = `│${active ? ">" : " "} ${chevron} `;
        const suffixPlain = ` ${kindBadge} +${file.added} / -${file.removed}`;
        const avail = Math.max(4, width - visibleWidth(markerPlain) - visibleWidth(suffixPlain));
        const displayName = truncatePath(safeText(basename), avail);
        const nameWithChevron = this.actions.style("bold", `${chevron} ${displayName}`);

        const line = `${prefix}${nameWithChevron} ${kindStyled} ${addStr}${sepStr}${delStr}`;
        return selected ? this.actions.style("selectedBg", truncateToWidth(line, Math.max(0, width), "…"))
                        : truncateToWidth(line, Math.max(0, width), "…");
      }
      const statMsg = "[estadísticas no disponibles]";
      const kindBadge = `[${kind}]`;
      const kindStyled = this.actions.style("muted", kindBadge);
      const nameWithChevron = this.actions.style("bold", `${chevron} ${safeText(basename)}`);
      const text = `${nameWithChevron} ${kindStyled} ${this.actions.style("dim", statMsg)}${file.notice ? ` · ${this.actions.style("warning", safeText(file.notice))}` : ""}`;
      const line = `${prefix}${text}`;
      return selected ? this.actions.style("selectedBg", truncateToWidth(line, Math.max(0, width), "…"))
                      : truncateToWidth(line, Math.max(0, width), "…");
    }

    // 2. File Path (Line 2 of 2: Indented secondary relative path)
    if (entry.kind === "file_path") {
      const { file } = entry;
      const indent = "    ";
      const avail = Math.max(4, width - visibleWidth(prefix) - visibleWidth(indent));
      const displayPath = truncatePath(safeText(file.path), avail);
      const line = `${prefix}${indent}${this.actions.style("dim", displayPath)}`;
      return selected ? this.actions.style("selectedBg", truncateToWidth(line, Math.max(0, width), "…"))
                      : truncateToWidth(line, Math.max(0, width), "…");
    }

    // 3. Notice
    if (entry.kind === "notice") {
      const line = `${prefix}${this.actions.style("muted", safeText(entry.text))}`;
      return truncateToWidth(line, Math.max(0, width), "…");
    }

    // 4. Hunk Header
    if (entry.kind === "hunk") {
      const line = `${prefix}${this.actions.style("muted", safeText(entry.row.text))}`;
      return selected ? this.actions.style("selectedBg", truncateToWidth(line, Math.max(0, width), "…"))
                      : truncateToWidth(line, Math.max(0, width), "…");
    }

    // 5. Code Row
    const { row } = entry;
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
    if (selected) {
      // Visual selection priority: applies selected background over the whole line
      return this.actions.style("selectedBg", truncateToWidth(line, Math.max(0, width), "…"));
    }
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
    if (!entry) return;
    if (entry.kind === "file_header" || entry.kind === "file_path") {
      const path = entry.file.path;
      if (!this.expanded.delete(path)) this.expanded.add(path);
      this.rebuild();
      this.reveal();
      return;
    }
    if (entry.kind === "hunk") {
      this.selectHunkAt(this.cursor);
      return;
    }
    if (entry.kind === "row") {
      if (this.selectionAnchor === this.cursor && this.selectionFocus === this.cursor) {
        this.clearSelection();
      } else {
        this.selectionAnchor = this.cursor;
        this.selectionFocus = this.cursor;
      }
      this.actions.render();
    }
  }

  private jump(direction: number, kind: "file" | "hunk"): void {
    for (let index = this.cursor + direction; index >= 0 && index < this.diffEntries.length; index += direction) {
      const entry = this.diffEntries[index]!;
      if ((kind === "file" && entry.kind === "file_header") || (kind === "hunk" && entry.kind === "hunk")) {
        this.cursor = index;
        return;
      }
    }
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "tab")) { this.actions.editor(); return; }
    if (data === "q") { this.actions.close(); return; }
    if (data === "i") { this.inspecting = !this.inspecting; this.actions.render(); return; }
    if (data === "a") { this.transferContext(); return; }

    // Resize dock shortcuts: < / > or Ctrl+Left / Ctrl+Right
    if (data === "<" || data === "," || data === "\x1b[1;5D") {
      this.actions.resize?.(-4);
      return;
    }
    if (data === ">" || data === "." || data === "\x1b[1;5C") {
      this.actions.resize?.(4);
      return;
    }

    // Shift + Up / Shift + Down for range selection
    if (data === "\x1b[1;2A" || matchesKey(data, "shift+up")) {
      if (this.selectionAnchor === null) this.selectionAnchor = this.cursor;
      this.cursor = Math.max(0, this.cursor - 1);
      this.selectionFocus = this.cursor;
      this.reveal();
      this.actions.render();
      return;
    }
    if (data === "\x1b[1;2B" || matchesKey(data, "shift+down")) {
      if (this.selectionAnchor === null) this.selectionAnchor = this.cursor;
      this.cursor = Math.min(this.diffEntries.length - 1, this.cursor + 1);
      this.selectionFocus = this.cursor;
      this.reveal();
      this.actions.render();
      return;
    }

    if (matchesKey(data, "enter")) this.toggle();
    else if (matchesKey(data, "down")) {
      if (this.hasSelection()) this.clearSelection();
      this.cursor++;
    }
    else if (matchesKey(data, "up")) {
      if (this.hasSelection()) this.clearSelection();
      this.cursor--;
    }
    else if (matchesKey(data, "right") || data === "l") { this.panX += 8; this.actions.render(); return; }
    else if (matchesKey(data, "left") || data === "h") { this.panX = Math.max(0, this.panX - 8); this.actions.render(); return; }
    else if (matchesKey(data, "pageDown")) {
      if (this.hasSelection()) this.clearSelection();
      this.cursor += Math.max(1, this.body.viewportHeight - 1);
    }
    else if (matchesKey(data, "pageUp")) {
      if (this.hasSelection()) this.clearSelection();
      this.cursor -= Math.max(1, this.body.viewportHeight - 1);
    }
    else if (matchesKey(data, "home") || data === "0") {
      if (this.hasSelection()) this.clearSelection();
      this.cursor = 0; this.panX = 0;
    }
    else if (matchesKey(data, "end")) {
      if (this.hasSelection()) this.clearSelection();
      this.cursor = this.diffEntries.length - 1;
    }
    else if (data === "]" || data === "[") {
      if (this.hasSelection()) this.clearSelection();
      this.jump(data === "]" ? 1 : -1, "file");
    }
    else if (data === "}" || data === "{") {
      if (this.hasSelection()) this.clearSelection();
      this.jump(data === "}" ? 1 : -1, "hunk");
    }
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
      const delta = event.wheelDelta ?? 0;
      const step = Math.abs(delta) === 1 ? delta * 2 : delta;
      this.body.scrollBy(step);
      return { ...result, render: true };
    }

    // Header click focuses panel
    if (event.y === 0) {
      return { ...result, focus: true, render: true };
    }

    // Separator resize drag
    if (event.x === 0 || this.resizingSeparator) {
      if (event.button === "left" && event.type === "press") {
        this.resizingSeparator = true;
        return { ...result, capture: true, render: true };
      }
      if (event.type === "drag" && this.resizingSeparator) {
        // Calculate dock width from screen coordinates
        const totalCols = event.screenX + (event.width - event.x);
        const newDockW = totalCols - event.screenX;
        this.actions.setDockWidth?.(newDockW);
        return { ...result, capture: true, render: true };
      }
      if (event.type === "release") {
        this.resizingSeparator = false;
        return { ...result, render: true };
      }
    }

    if (event.type === "release") {
      this.isDraggingSelection = false;
      return { ...result, render: false };
    }

    if (event.button !== "left") return;

    // Line click and range dragging
    if (event.y > 0 && event.y < event.height - 1) {
      const targetIndex = Math.max(0, Math.min(this.diffEntries.length - 1, this.body.scrollTop + event.y - 1));
      if (event.type === "press") {
        this.pressed = true;
        this.cursor = targetIndex;
        const entry = this.diffEntries[targetIndex];
        if (entry && (entry.kind === "file_header" || entry.kind === "file_path")) {
          this.toggle();
        } else if (entry && entry.kind === "hunk") {
          this.selectHunkAt(targetIndex);
        } else {
          this.selectionAnchor = targetIndex;
          this.selectionFocus = targetIndex;
          this.isDraggingSelection = true;
        }
        return { ...result, capture: true, focus: true, render: true };
      }

      if (event.type === "drag" && this.isDraggingSelection) {
        this.selectionFocus = targetIndex;
        this.cursor = targetIndex;
        this.reveal();
        return { ...result, capture: true, render: true };
      }

      if (event.type === "click") {
        if (this.pressed) {
          this.pressed = false;
          return { ...result, render: false };
        }
        this.cursor = targetIndex;
        this.toggle();
        return { ...result, focus: true, render: true };
      }
    }
    return { ...result, render: false };
  }
}
