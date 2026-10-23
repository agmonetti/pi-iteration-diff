import { TextDecoder } from "node:util";
import type { CaptureState, CapturedWindow } from "../lifecycle/iteration-capture.js";
import type { FileDelta } from "../snapshots/model.js";

export interface IterationView {
  readonly key: string;
  readonly title: string;
  readonly notices: readonly string[];
  readonly files: readonly DiffFile[];
}

export interface DiffFile {
  readonly path: string;
  readonly kind: "created" | "modified" | "deleted";
  readonly added?: number;
  readonly removed?: number;
  readonly notice?: string;
  getRows(): readonly DiffRow[];
}

export interface DiffRow {
  readonly kind: "hunk" | "context" | "added" | "removed" | "notice";
  readonly text: string;
  readonly oldLine?: number;
  readonly newLine?: number;
}

/** Endpoints share input limits. Merged hunks never repeat lines, bounding cached output to 2*lines + 2*files rows. */
export const iterationDiffLimits = Object.freeze({
  files: 64,
  fileBytes: 256 * 1024,
  bytes: 2 * 1024 * 1024,
  fileLines: 2_000,
  lines: 16_000,
  fileWork: 250_000,
  work: 1_000_000,
  context: 3,
  rows: 32_128,
});

const limitsNotice = "Límites del visor: 64 archivos; 256 KiB y 2000 líneas por archivo (ambos extremos); " +
  "2 MiB y 16000 líneas en total; 250000 celdas LCS por archivo y 1000000 en total; " +
  "salida máxima de 32128 filas; contexto de 3 líneas.";
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
interface Budget { bytes: number; lines: number; work: number }
interface TextPair { old: readonly string[]; next: readonly string[]; prefix: number; suffix: number }

function unavailable(file: FileDelta, notice: string): DiffFile {
  let rows: readonly DiffRow[] | undefined;
  return { path: file.path, kind: file.kind, notice,
    getRows: () => rows ??= [{ kind: "notice", text: notice }] };
}

/** Tokens include LF and retain CR/BOM, so EOL-only byte changes are real changes. */
function lines(text: string, limit: number): string[] | undefined {
  const result: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      if (result.length === limit) return;
      result.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) {
    if (result.length === limit) return;
    result.push(text.slice(start));
  }
  return result;
}

function matchingEdges(old: readonly string[], next: readonly string[]): TextPair {
  let prefix = 0;
  while (prefix < old.length && prefix < next.length && old[prefix] === next[prefix]) prefix++;
  let suffix = 0;
  while (suffix < old.length - prefix && suffix < next.length - prefix &&
    old[old.length - suffix - 1] === next[next.length - suffix - 1]) suffix++;
  return { old, next, prefix, suffix };
}

/** Statistics only: no edit script, content rows or hunks exist while collapsed. */
function commonLines(pair: TextPair): number {
  const { old, next, prefix, suffix } = pair;
  const n = old.length - prefix - suffix;
  const m = next.length - prefix - suffix;
  if (!n || !m) return prefix + suffix;
  let previous = new Uint16Array(m + 1);
  let current = new Uint16Array(m + 1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      current[j + 1] = old[prefix + i] === next[prefix + j] ? previous[j] + 1 :
        Math.max(previous[j + 1], current[j]);
    }
    const swap = previous;
    previous = current;
    current = swap;
    current[0] = 0;
  }
  return prefix + suffix + previous[m];
}

interface Edit { kind: "context" | "added" | "removed"; token: string; oldLine: number; newLine: number }

/** Runs only on expansion. The matrix fits in at most ~0.51 MiB per invocation. */
function edits(pair: TextPair): Edit[] {
  const { old, next, prefix, suffix } = pair;
  const n = old.length - prefix - suffix;
  const m = next.length - prefix - suffix;
  const stride = m + 1;
  const matrix = n && m ? new Uint16Array((n + 1) * stride) : undefined;
  if (matrix) {
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        matrix[i * stride + j] = old[prefix + i] === next[prefix + j] ?
          matrix[(i + 1) * stride + j + 1] + 1 :
          Math.max(matrix[(i + 1) * stride + j], matrix[i * stride + j + 1]);
      }
    }
  }
  const result: Edit[] = [];
  let i = 0;
  let j = 0;
  const push = (kind: Edit["kind"]): void => {
    result.push({ kind, token: kind === "added" ? next[j] : old[i], oldLine: i + 1, newLine: j + 1 });
    if (kind !== "added") i++;
    if (kind !== "removed") j++;
  };
  while (i < prefix) push("context");
  while (i < old.length - suffix || j < next.length - suffix) {
    if (i < old.length - suffix && j < next.length - suffix && old[i] === next[j]) push("context");
    else if (i < old.length - suffix && (j === next.length - suffix || !matrix ||
      matrix[(i - prefix + 1) * stride + j - prefix] >= matrix[(i - prefix) * stride + j - prefix + 1])) push("removed");
    else push("added");
  }
  while (i < old.length) push("context");
  return result;
}

function unifiedRows(pair: TextPair): readonly DiffRow[] {
  const script = edits(pair);
  const ranges: { start: number; end: number }[] = [];
  for (let index = 0; index < script.length; index++) {
    if (script[index].kind === "context") continue;
    const start = Math.max(0, index - iterationDiffLimits.context);
    const end = Math.min(script.length, index + iterationDiffLimits.context + 1);
    const previous = ranges.at(-1);
    if (previous && start <= previous.end) previous.end = Math.max(previous.end, end);
    else ranges.push({ start, end });
  }
  const result: DiffRow[] = [];
  for (const { start, end } of ranges) {
    let oldCount = 0;
    let newCount = 0;
    for (let index = start; index < end; index++) {
      if (script[index].kind !== "added") oldCount++;
      if (script[index].kind !== "removed") newCount++;
    }
    const first = script[start];
    const oldStart = first.oldLine - (oldCount === 0 ? 1 : 0);
    const newStart = first.newLine - (newCount === 0 ? 1 : 0);
    result.push({ kind: "hunk", text: `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@` });
    for (let index = start; index < end; index++) {
      const edit = script[index];
      const terminated = edit.token.endsWith("\n");
      result.push({ kind: edit.kind, text: terminated ? edit.token.slice(0, -1) : edit.token,
        ...(edit.kind !== "added" ? { oldLine: edit.oldLine } : {}),
        ...(edit.kind !== "removed" ? { newLine: edit.newLine } : {}) });
      if (!terminated) result.push({ kind: "notice", text: "\\ Sin salto de línea al final del archivo" });
    }
  }
  return result;
}

function createFile(file: FileDelta, budget: Budget): DiffFile {
  if ((file.kind !== "created" && !file.before) || (file.kind !== "deleted" && !file.after)) {
    return unavailable(file, "Diff no disponible: falta contenido de un extremo de la captura.");
  }
  const size = (file.before?.length ?? 0) + (file.after?.length ?? 0);
  if (size > iterationDiffLimits.fileBytes) return unavailable(file, "Diff no disponible: límite de 256 KiB por archivo.");
  if (size > budget.bytes) return unavailable(file, "Diff no disponible: límite total de 2 MiB del visor.");
  budget.bytes -= size;
  let old: string[] | undefined;
  let next: string[] | undefined;
  const lineLimit = Math.min(iterationDiffLimits.fileLines, budget.lines);
  if (file.before?.includes(0) || file.after?.includes(0)) return unavailable(file, "Contenido binario (NUL): diff textual no disponible.");
  try {
    old = file.before ? lines(decoder.decode(file.before), lineLimit) : [];
    next = old ? (file.after ? lines(decoder.decode(file.after), lineLimit - old.length) : []) : undefined;
  } catch {
    return unavailable(file, "Contenido no válido como UTF-8: diff textual no disponible.");
  }
  if (!old || !next) return unavailable(file, budget.lines < iterationDiffLimits.fileLines ?
    "Diff no disponible: límite total de 16000 líneas del visor." : "Diff no disponible: límite de 2000 líneas por archivo.");
  budget.lines -= old.length + next.length;
  const pair = matchingEdges(old, next);
  const work = (old.length - pair.prefix - pair.suffix) * (next.length - pair.prefix - pair.suffix);
  if (work > iterationDiffLimits.fileWork) return unavailable(file, "Diff no disponible: límite de 250000 celdas de comparación por archivo.");
  if (work > budget.work) return unavailable(file, "Diff no disponible: límite total de 1000000 celdas de comparación.");
  budget.work -= work;
  const common = commonLines(pair);
  let rows: readonly DiffRow[] | undefined;
  return { path: file.path, kind: file.kind, added: next.length - common, removed: old.length - common,
    getRows: () => rows ??= unifiedRows(pair) };
}

const reasonText: Readonly<Record<string, string>> = {
  "no-capture": "No hay una captura de iteración disponible.",
  "scope-invalidated": "Captura invalidada por cambio de sesión o raíz.",
  "input-not-confirmed": "La entrada todavía no tiene una ejecución confirmada.",
  "grouped-window": "Ventana agrupada: no se puede aislar una iteración individual.",
  unverified: "No se pudo verificar la atribución a una entrada individual.",
  partial: "La captura es parcial; no representa un resultado completo.",
  cancelled: "Ejecución cancelada: solo se muestran cambios netos observados.",
  failed: "La ejecución falló: solo se muestran cambios netos observados.",
};

function windowNotices(window: CapturedWindow): string[] {
  const notices = ["Diff neto entre snapshots de la ventana; no demuestra autoría ni conserva escrituras intermedias."];
  if (window.attribution === "grouped") notices.push(`Ventana agrupada (${window.inputCount} entradas observadas): no es la última iteración individual.`);
  if (window.attribution === "unverified") notices.push(reasonText.unverified);
  if (window.status !== "complete") notices.push(reasonText[window.status]);
  if (window.delta.status === "partial" || !window.before.enumerationComplete || !window.after.enumerationComplete) {
    notices.push("Captura incompleta: pueden faltar archivos o cambios; la ausencia de cambios no demuestra un resultado vacío.");
  }
  if (window.before.omitted.size || window.after.omitted.size) {
    notices.push(`Rutas omitidas en los snapshots: ${window.before.omitted.size} antes; ${window.after.omitted.size} después.`);
  }
  // Capture issue codes are retained, but diagnostics cannot make the panel unbounded.
  const issues: string[] = [];
  let extra = false;
  for (const source of [window.delta.issues, window.before.issues, window.after.issues]) {
    for (const issue of source.slice(0, 9)) {
      const bounded = issue.length > 256 ? `${issue.slice(0, 256)}…` : issue;
      if (issues.includes(bounded)) continue;
      if (issues.length === 8) { extra = true; break; }
      issues.push(bounded);
    }
    if (source.length > 9) extra = true;
  }
  if (issues.length) notices.push(`Avisos de captura: ${issues.join(", ")}${extra ? "; más avisos omitidos por límite" : ""}.`);
  return notices;
}

export function createIterationView(state: CaptureState): IterationView {
  if (state.state === "capturing") return { key: JSON.stringify([state.state, state.id.sessionId, state.id.root, state.id.runtimeEpoch, state.id.sequence]),
    title: "Capturando iteración", notices: ["Captura en curso; todavía no hay un diff final disponible."], files: [] };
  if (state.state === "unavailable" && !state.window) return { key: JSON.stringify([state.state, state.reason]),
    title: "Diff no disponible", notices: [reasonText[state.reason] ?? `Captura no disponible: ${state.reason.slice(0, 256)}.`], files: [] };
  const window = state.window!;
  const notices = windowNotices(window);
  if (state.state === "unavailable") {
    const reason = reasonText[state.reason] ?? `Captura no disponible: ${state.reason.slice(0, 256)}.`;
    if (!notices.includes(reason)) notices.push(reason);
  }
  const budget: Budget = { bytes: iterationDiffLimits.bytes, lines: iterationDiffLimits.lines, work: iterationDiffLimits.work };
  const files = window.delta.changes.slice(0, iterationDiffLimits.files).map(file => createFile(file, budget));
  if (window.delta.changes.length > files.length) notices.push(`Límite de archivos: se muestran ${files.length} de ${window.delta.changes.length} cambios; el resto no se construye.`);
  if (!files.length) notices.push(window.status === "complete" && window.delta.status === "complete" &&
    window.before.enumerationComplete && window.after.enumerationComplete ? "Sin cambios netos observados en esta ventana." :
    "Sin cambios verificables en la captura disponible; no implica que la ventana esté vacía.");
  notices.push(limitsNotice);
  const title = window.attribution === "grouped" ? "Ventana agrupada · diff neto" :
    window.attribution === "unverified" ? "Ventana sin atribución individual verificada" :
    window.status === "complete" ? "Última iteración" : "Iteración · resultado no completo";
  return { key: JSON.stringify([state.state, window.id.sessionId, window.id.root, window.id.runtimeEpoch, window.id.sequence, window.attribution, window.status]), title, notices, files };
}
