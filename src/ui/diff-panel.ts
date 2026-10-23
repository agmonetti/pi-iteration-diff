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
  | { kind: "row"; file: DiffFile; row: DiffRow; hunkIndex: number; rowIndex: number; gutterMode: "new_only" | "old_only" | "dual" }
  | { kind: "notice"; text: string; file?: DiffFile };

// Pi exposes this shape through VStack, not through the package entry exports.
interface PanelMouseDispatch extends TuiMouseEventResult {
  handled: true;
  target: { component: Component; originX: number; originY: number; width: number; height: number };
}

export function localizeNotice(text: string): string {
  if (text.startsWith("Diff neto entre snapshots") || text.startsWith("Net diff between")) {
    return "Net diff between window snapshots; does not prove authorship or retain intermediate writes.";
  }
  if (text.startsWith("Ventana agrupada") || text.startsWith("Grouped window")) {
    return text.replace("Ventana agrupada", "Grouped window").replace("entradas observadas", "inputs observed").replace("no es la última iteración individual.", "not the last individual iteration.");
  }
  if (text.startsWith("No se pudo verificar la atribución") || text.startsWith("Could not verify attribution")) {
    return "Could not verify attribution to an individual input.";
  }
  if (text.startsWith("La captura es parcial") || text.startsWith("Capture is partial")) {
    return "Capture is partial; does not represent a complete result.";
  }
  if (text.startsWith("Ejecución cancelada") || text.startsWith("Run cancelled")) {
    return "Run cancelled: only observed net changes are shown.";
  }
  if (text.startsWith("La ejecución falló") || text.startsWith("Run failed")) {
    return "Run failed: only observed net changes are shown.";
  }
  if (text.startsWith("Captura incompleta") || text.startsWith("Incomplete capture")) {
    return "Incomplete capture: files or changes may be missing; lack of changes does not prove an empty result.";
  }
  if (text.startsWith("Rutas omitidas en los snapshots") || text.startsWith("Omitted paths")) {
    return text.replace("Rutas omitidas en los snapshots:", "Omitted paths in snapshots:").replace("antes;", "before;").replace("después.", "after.");
  }
  if (text.startsWith("Avisos de captura") || text.startsWith("Capture notices")) {
    return text.replace("Avisos de captura:", "Capture notices:");
  }
  if (text.startsWith("Límites del visor") || text.startsWith("Viewer limits")) {
    return "Viewer limits: 64 files; 256 KiB and 2000 lines per file; 2 MiB and 16000 lines total; 32128 max rows; 3 context lines.";
  }
  if (text.startsWith("Límite de archivos:") || text.startsWith("File limit:")) {
    return text.replace("Límite de archivos: se muestran", "File limit: showing")
      .replace("de", "of")
      .replace("cambios; el resto no se construye.", "changes; remainder not built.");
  }
  if (text.startsWith("Contenido no válido como UTF-8") || text.startsWith("Invalid UTF-8")) {
    return "Invalid UTF-8 content: textual diff unavailable.";
  }
  if (text.startsWith("Diff no disponible: límite total de 16000 líneas")) {
    return "Diff unavailable: 16,000 total lines viewer limit.";
  }
  if (text.startsWith("Diff no disponible: límite de 2000 líneas por archivo")) {
    return "Diff unavailable: 2,000 lines per file limit.";
  }
  if (text.startsWith("Diff no disponible: límite de 250000 celdas")) {
    return "Diff unavailable: 250,000 comparison cells per file limit.";
  }
  if (text.startsWith("Diff no disponible: límite total de 1000000 celdas")) {
    return "Diff unavailable: 1,000,000 total comparison cells limit.";
  }
  if (text.startsWith("No se observaron cambios") || text.startsWith("Sin cambios netos") || text.startsWith("No net changes")) {
    return "No net changes observed in this iteration.";
  }
  if (text.startsWith("Sin cambios verificables") || text.startsWith("No verifiable changes")) {
    return "No verifiable changes in available capture; does not imply the window is empty.";
  }
  if (text.startsWith("Diff no disponible: archivo binario.") || text.startsWith("Diff unavailable")) {
    return "Diff unavailable: binary file.";
  }
  if (text.startsWith("Captura no disponible:") || text.startsWith("Capture unavailable:")) {
    return text.replace("Captura no disponible:", "Capture unavailable:");
  }
  if (text.startsWith("No hay una captura de iteración disponible.")) {
    return "No iteration capture available.";
  }
  if (text.startsWith("Captura invalidada por cambio de sesión o raíz.")) {
    return "Capture invalidated by session or root change.";
  }
  if (text.startsWith("La entrada todavía no tiene una ejecución confirmada.")) {
    return "Input does not yet have a confirmed run.";
  }
  if (text.startsWith("Captura en curso; todavía no hay un diff final disponible.")) {
    return "Capture in progress; no final diff available yet.";
  }
  if (text.startsWith("Avisos adicionales omitidos por límite de vista.")) {
    return "Additional notices omitted due to view limit.";
  }
  return text;
}

/** All workspace strings are untrusted terminal data, never ANSI markup. */
function safeText(text: string): string {
  const bounded = text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}… [text truncated]` : text;
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
  private showDetails = false;

  // Selection state
  private selectionAnchor: number | null = null;
  private selectionFocus: number | null = null;
  private isDraggingSelection = false;
  private resizingSeparator = false;

  constructor(private readonly actions: Actions) {
    super();
    this.body = new VirtualDiffScroll(() => this.diffEntries.length, (index, width) => this.entryLine(index, width));
    this.addChild({ invalidate() {}, render: width => this.heading(width) }, { basis: 2, shrink: 0, minSize: 2 });
    this.addChild(this.body, { basis: 0, grow: 1, shrink: 1, minSize: 0 });
    this.addChild({ invalidate() {}, render: width => [this.footer(width)] }, { basis: 1, shrink: 0, minSize: 1 });
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
      this.showDetails = false;
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
    const hasFiles = this.view.files.length > 0;

    for (const text of this.view.notices.slice(0, MAX_NOTICES)) {
      if (hasFiles && !this.showDetails) {
        if (text.startsWith("Diff neto entre snapshots") ||
            text.startsWith("Net diff between") ||
            text.startsWith("Límites del visor") ||
            text.startsWith("Viewer limits") ||
            text.startsWith("Rutas omitidas en los snapshots") ||
            text.startsWith("Omitted paths") ||
            text.startsWith("Avisos adicionales omitidos") ||
            text.startsWith("Additional notices omitted")) {
          continue;
        }
      }
      entries.push({ kind: "notice", text: localizeNotice(text) });
    }
    if (this.showDetails && this.view.notices.length > MAX_NOTICES) {
      entries.push({ kind: "notice", text: "Additional notices omitted due to view limit." });
    }
    let remaining = MAX_CONTENT_ROWS;
    for (const file of this.view.files.slice(0, MAX_FILES)) {
      entries.push({ kind: "file_header", file });
      entries.push({ kind: "file_path", file });
      if (!this.expanded.has(file.path)) continue;
      if (file.notice) entries.push({ kind: "notice", text: localizeNotice(file.notice), file });
      if (remaining === 0) {
        entries.push({ kind: "notice", text: `Content omitted: global limit of ${MAX_CONTENT_ROWS} rows. Collapse other files.` });
        continue;
      }
      const rows = file.getRows();
      const count = Math.min(rows.length, MAX_FILE_ROWS, remaining);
      let currentHunk = 0;
      const hasOld = rows.some(r => r.oldLine !== undefined);
      const hasNew = rows.some(r => r.newLine !== undefined);
      const gutterMode: "new_only" | "old_only" | "dual" =
        file.kind === "created" && !hasOld ? "new_only"
        : file.kind === "deleted" && !hasNew ? "old_only"
        : "dual";

      for (let index = 0; index < count; index++) {
        const row = rows[index]!;
        if (row.kind === "hunk") {
          currentHunk++;
          entries.push({ kind: "hunk", file, row, hunkIndex: currentHunk });
        } else {
          entries.push({ kind: "row", file, row, hunkIndex: currentHunk, rowIndex: index, gutterMode });
        }
      }
      remaining -= count;
      if (count < rows.length) {
        entries.push({ kind: "notice", text: `Diff truncated: ${count}/${rows.length} rows (maximum ${MAX_FILE_ROWS}/file and ${MAX_CONTENT_ROWS} total).` });
      }
    }
    if (this.view.files.length > MAX_FILES) {
      entries.push({ kind: "notice", text: `List truncated: ${MAX_FILES}/${this.view.files.length} files.` });
    }
    if (entries.length === 0) {
      entries.push({ kind: "notice", text: "No changes observed in this iteration." });
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
    if (!rows.length) return `${entries.length} ${entries.length === 1 ? "line" : "lines"}`;
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
    return `${range} (${rows.length} ${rows.length === 1 ? "line" : "lines"})`;
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

  private getScope(): string {
    const rawTitle = safeText(this.view.title);
    const lower = rawTitle.toLowerCase();
    const isPartial = lower.includes("parcial") ||
      lower.includes("resultado no completo") ||
      this.view.notices.some(n => n.toLowerCase().includes("incompleta") || n.toLowerCase().includes("parcial"));

    if (lower.includes("agrupada") || lower.includes("batch")) {
      return "Batch Net";
    }
    if (lower.includes("sin atribución") || lower.includes("unverified")) {
      return "Unverified";
    }
    if (lower.includes("interrumpida") || lower.includes("cancelada") || lower.includes("cancelled")) {
      return "Cancelled";
    }
    if (lower.includes("fallida") || lower.includes("falló") || lower.includes("failed")) {
      return "Failed";
    }
    if (isPartial) {
      return "Partial";
    }
    if (lower.includes("no disponible") || lower.includes("unavailable")) {
      return "Unavailable";
    }
    if (lower.includes("capturando") || lower.includes("capturing")) {
      return "Capturing";
    }
    return "Last iteration";
  }

  private heading(width: number): string[] {
    if (width <= 0) return [];
    const rawTitle = safeText(this.view.title);
    const scope = rawTitle.toUpperCase().startsWith("DIFF:") ? rawTitle : this.getScope();
    const leftText = scope.startsWith("DIFF") ? scope : `DIFF · ${scope}`;
    const leftPrefix = `│ ${leftText}`;
    const fileCount = this.view.files.length;
    const rightText = `${fileCount} ${fileCount === 1 ? "file" : "files"}`;

    const titleStyle = this.focused ? "accent" : "muted";
    const spacesCount = width - visibleWidth(leftPrefix) - visibleWidth(rightText);
    let line1: string;
    if (spacesCount >= 1) {
      const leftStyled = this.actions.style(titleStyle, leftPrefix);
      const rightStyled = this.actions.style("muted", rightText);
      line1 = `${leftStyled}${" ".repeat(spacesCount)}${rightStyled}`;
    } else {
      if (width - visibleWidth(rightText) - 1 >= visibleWidth("│ DIFF")) {
        const availLeft = width - visibleWidth(rightText) - 1;
        const leftTrunc = truncateToWidth(leftPrefix, availLeft, "…");
        line1 = `${this.actions.style(titleStyle, leftTrunc)} ${this.actions.style("muted", rightText)}`;
      } else {
        line1 = this.actions.style(titleStyle, truncateToWidth(leftPrefix, width, "…"));
      }
    }

    const border = this.actions.style("border", "│");
    let line2Content: string;
    if (fileCount === 0) {
      line2Content = this.actions.style("dim", "No changes");
    } else {
      const hasAdded = this.view.files.some(f => f.added !== undefined);
      const hasRemoved = this.view.files.some(f => f.removed !== undefined);
      if (!hasAdded && !hasRemoved) {
        line2Content = this.actions.style("dim", "stats unavailable");
      } else {
        const totalAdded = this.view.files.reduce((sum, f) => sum + (f.added ?? 0), 0);
        const totalRemoved = this.view.files.reduce((sum, f) => sum + (f.removed ?? 0), 0);
        const addStr = this.actions.style("added", `+${totalAdded}`);
        const sepStr = this.actions.style("dim", " / ");
        const delStr = this.actions.style("removed", `-${totalRemoved}`);
        line2Content = `${addStr}${sepStr}${delStr}`;
      }
    }
    const line2 = truncateToWidth(`${border} ${line2Content}`, width, "…");
    return [line1, line2];
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
      const entries = this.getSelectedEntries();
      const rows = entries.filter((e): e is Entry & { kind: "row" } => e.kind === "row");
      const count = rows.length || entries.length;
      const lineWord = count === 1 ? "line" : "lines";
      const short = width < 55;
      const text = short
        ? `│ ${count} ${lineWord} selected · a: append`
        : `│ Sel: ${summary} · a: append to editor`;
      return this.actions.style("accent", truncateToWidth(text, width, "…"));
    }

    const panStr = this.panX > 0 ? ` [pan +${this.panX}]` : "";
    let text: string;
    if (width < 50) {
      text = `│ Enter: expand${panStr} · a: append · Esc: editor`;
    } else if (width < 75) {
      text = `│ Enter: expand${panStr} · a: append · ↑↓: navigate · Esc: editor`;
    } else {
      text = `│ Enter: expand${panStr} · a: append · ↑↓: navigate · Esc: editor · d: details`;
    }
    return this.actions.style("muted", truncateToWidth(text, width, "…"));
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
      const kind = { created: "created", modified: "modified", deleted: "deleted" }[file.kind];
      const chevron = this.expanded.has(file.path) ? "▾" : "▸";
      const parts = file.path.split("/");
      const basename = parts[parts.length - 1] || file.path;

      let content: string;
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

        content = `${nameWithChevron} ${kindStyled} ${addStr}${sepStr}${delStr}`;
      } else {
        const statMsg = "[stats unavailable]";
        const kindBadge = `[${kind}]`;
        const kindStyled = this.actions.style("muted", kindBadge);
        const nameWithChevron = this.actions.style("bold", `${chevron} ${safeText(basename)}`);
        content = `${nameWithChevron} ${kindStyled} ${this.actions.style("dim", statMsg)}${file.notice ? ` · ${this.actions.style("warning", safeText(localizeNotice(file.notice)))}` : ""}`;
      }
      if (selected) {
        const lineContent = `${cursor} ${content}`;
        const styledContent = this.actions.style("selectedBg", truncateToWidth(lineContent, Math.max(0, width - 1), "…"));
        return `${border}${styledContent}`;
      }
      return truncateToWidth(`${prefix}${content}`, Math.max(0, width), "…");
    }

    // 2. File Path (Line 2 of 2: Indented secondary relative path)
    if (entry.kind === "file_path") {
      const { file } = entry;
      const indent = "    ";
      const avail = Math.max(4, width - visibleWidth(prefix) - visibleWidth(indent));
      const displayPath = truncatePath(safeText(file.path), avail);
      const content = `${indent}${this.actions.style("dim", displayPath)}`;
      if (selected) {
        const lineContent = `${cursor} ${content}`;
        const styledContent = this.actions.style("selectedBg", truncateToWidth(lineContent, Math.max(0, width - 1), "…"));
        return `${border}${styledContent}`;
      }
      return truncateToWidth(`${prefix}${content}`, Math.max(0, width), "…");
    }

    // 3. Notice
    if (entry.kind === "notice") {
      const content = this.actions.style("muted", safeText(entry.text));
      return truncateToWidth(`${prefix}${content}`, Math.max(0, width), "…");
    }

    // 4. Hunk Header
    if (entry.kind === "hunk") {
      const content = this.actions.style("muted", safeText(entry.row.text));
      if (selected) {
        const lineContent = `${cursor} ${content}`;
        const styledContent = this.actions.style("selectedBg", truncateToWidth(lineContent, Math.max(0, width - 1), "…"));
        return `${border}${styledContent}`;
      }
      return truncateToWidth(`${prefix}${content}`, Math.max(0, width), "…");
    }

    // 5. Code Row
    const { row } = entry;
    const old = row.oldLine === undefined ? "" : String(row.oldLine);
    const next = row.newLine === undefined ? "" : String(row.newLine);
    const mark = row.kind === "added" ? "+" : row.kind === "removed" ? "-" : " ";

    let numStr: string;
    if (entry.gutterMode === "new_only") {
      numStr = this.actions.style("dim", next.padStart(4));
    } else if (entry.gutterMode === "old_only") {
      numStr = this.actions.style("dim", old.padStart(4));
    } else {
      numStr = this.actions.style("dim", `${old.padStart(4)} ${next.padStart(4)}`);
    }

    const markStr = row.kind === "added" ? this.actions.style("added", mark)
      : row.kind === "removed" ? this.actions.style("removed", mark)
      : mark;

    const rawCode = safeText(row.text);
    let codePart = rawCode;
    if (this.panX > 0) {
      codePart = sliceByColumn(rawCode, this.panX, Number.MAX_SAFE_INTEGER);
    }
    const sep = this.panX > 0 ? this.actions.style("dim", "«") : " ";
    const codeStyled = row.kind === "added" ? this.actions.style("added", codePart)
      : row.kind === "removed" ? this.actions.style("removed", codePart)
      : this.actions.style("text", codePart);

    const content = `${numStr} ${markStr}${sep}${codeStyled}`;
    if (selected) {
      const lineContent = `${cursor} ${content}`;
      const styledContent = this.actions.style("selectedBg", truncateToWidth(lineContent, Math.max(0, width - 1), "…"));
      return `${border}${styledContent}`;
    }
    return truncateToWidth(`${prefix}${content}`, Math.max(0, width), "…");
  }

  override render(width: number): string[] {
    if (width <= 0) return [];
    return [...this.heading(width), ...this.body.visible(width), this.footer(width)];
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
    if (data === "d") { this.showDetails = !this.showDetails; this.rebuild(); this.actions.render(); return; }
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

    // Header click focuses panel and toggles details on demand
    if (event.y === 0 || event.y === 1) {
      if (event.type === "click" || (event.type === "press" && this.focused)) {
        this.showDetails = !this.showDetails;
        this.rebuild();
      }
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
    if (event.y >= 2 && event.y < event.height - 1) {
      const targetIndex = Math.max(0, Math.min(this.diffEntries.length - 1, this.body.scrollTop + event.y - 2));
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
