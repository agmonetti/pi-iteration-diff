import { createHash, randomUUID } from "node:crypto";
import { captureSnapshot, type CaptureLimits } from "../snapshots/capture.js";
import { compareSnapshots, type NetDelta, type Snapshot } from "../snapshots/model.js";

export interface CaptureScope { readonly sessionId: string; readonly root: string }
export interface WindowId extends CaptureScope { readonly runtimeEpoch: string; readonly sequence: number }
export interface CapturedWindow {
  readonly id: WindowId;
  readonly attribution: "individual" | "grouped" | "unverified";
  readonly status: "complete" | "partial" | "cancelled" | "failed";
  readonly inputCount: number;
  readonly before: Snapshot;
  readonly after: Snapshot;
  readonly delta: NetDelta;
}
export type CaptureState =
  | { readonly state: "unavailable"; readonly reason: string; readonly window?: CapturedWindow }
  | { readonly state: "capturing"; readonly id: WindowId }
  | { readonly state: "individual"; readonly window: CapturedWindow };

type Capture = (root: string, signal: AbortSignal) => Promise<Snapshot>;
interface Candidate {
  readonly abort: AbortController;
  readonly baseline: Promise<Snapshot>;
  readonly fingerprint?: string;
  grouped: boolean;
  inputs: number;
}
interface Active extends Candidate {
  readonly id: WindowId;
  readonly expected?: string;
  unverified: boolean;
  users: number;
  outcome: "completed" | "aborted" | "error";
  closing: boolean;
}

export function inputFingerprint(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** No Pi/UI imports. Single observable window; never a per-turn or tool-based baseline. */
export class IterationCapture {
  private readonly runtimeEpoch = randomUUID();
  private sequence = 0;
  private scope?: CaptureScope;
  private candidate?: Candidate;
  private active?: Active;
  private current: CaptureState = { state: "unavailable", reason: "no-capture" };
  private readonly capture: Capture;

  constructor(limits: Partial<CaptureLimits> = {}, capture?: Capture) {
    const backend = capture ?? ((root: string, signal: AbortSignal) => captureSnapshot(root, limits, signal));
    let pending = Promise.resolve();
    this.capture = (root, signal) => {
      const job = pending.then(() => { signal.throwIfAborted(); return backend(root, signal); });
      pending = job.then(() => undefined, () => undefined);
      return job;
    };
  }

  get state(): CaptureState { return this.current; }

  /** Synchronous invalidation must precede any asynchronous session/root resolution. */
  invalidate(reason = "scope-invalidated"): void {
    this.candidate?.abort.abort();
    this.active?.abort.abort();
    this.candidate = undefined;
    this.active = undefined;
    this.scope = undefined;
    this.current = { state: "unavailable", reason };
  }

  setScope(scope: CaptureScope): void {
    if (scope.sessionId === this.scope?.sessionId && scope.root === this.scope.root) return;
    this.invalidate();
    this.scope = scope;
  }

  private start(fingerprint?: string): Candidate | undefined {
    if (!this.scope) return;
    const root = this.scope.root;
    const abort = new AbortController();
    const baseline = this.capture(root, abort.signal).catch((): Snapshot => ({ root, startedAt: Date.now(), finishedAt: Date.now(),
      files: new Map(), omitted: new Map(), enumerationComplete: false, bytes: 0, issues: ["capture-failed"] }));
    return { abort, baseline, fingerprint, grouped: false, inputs: 1 };
  }

  async input(text: string, idle: boolean, source: "interactive" | "rpc" | "extension", streaming: boolean, hasImages = false): Promise<void> {
    if (this.active) { this.active.grouped = true; this.active.inputs++; return; }
    if (this.candidate && (!idle || streaming)) { this.candidate.grouped = true; this.candidate.inputs++; return; }
    this.candidate?.abort.abort();
    // Release the previous result before allocating another endpoint pair; consumed inputs publish nothing.
    this.current = { state: "unavailable", reason: "input-not-confirmed" };
    const candidate = this.start(idle && !streaming && source !== "extension" && !hasImages ? inputFingerprint(text) : undefined);
    this.candidate = candidate;
    if (candidate) await candidate.baseline;
  }

  async beforeStart(prompt?: string): Promise<void> {
    if (!this.scope) return;
    if (this.active) { this.active.grouped = true; return; }
    const fingerprint = prompt === undefined ? undefined : inputFingerprint(prompt);
    const matched = fingerprint !== undefined && fingerprint === this.candidate?.fingerprint;
    let candidate = this.candidate;
    if (!matched) {
      const previous = candidate;
      previous?.abort.abort();
      candidate = this.start();
      if (candidate) {
        candidate.grouped = previous?.grouped ?? false;
        candidate.inputs = previous?.inputs ?? 0;
      }
    }
    this.candidate = undefined;
    if (!candidate) return;
    const active: Active = { ...candidate, id: { ...this.scope, runtimeEpoch: this.runtimeEpoch, sequence: ++this.sequence },
      expected: fingerprint, unverified: !matched, users: 0, outcome: "completed", closing: false };
    this.active = active;
    this.current = { state: "capturing", id: active.id };
    await active.baseline;
  }

  userMessage(fingerprint?: string): void {
    if (!this.active) return;
    this.active.users++;
    if (this.active.users > 1) this.active.grouped = true;
    if (this.active.users === 1 && fingerprint !== this.active.expected) this.active.unverified = true;
  }

  outcome(outcome: Active["outcome"]): void { if (this.active) this.active.outcome = outcome; }

  async settled(aborted: boolean): Promise<void> {
    const active = this.active;
    if (!active || active.closing) return;
    active.closing = true;
    const before = await active.baseline;
    if (this.active !== active || active.abort.signal.aborted) return;
    let after: Snapshot;
    try { after = await this.capture(active.id.root, active.abort.signal); }
    catch { after = { root: active.id.root, startedAt: Date.now(), finishedAt: Date.now(), files: new Map(), omitted: new Map(),
      enumerationComplete: false, bytes: 0, issues: ["capture-failed"] }; }
    if (this.active !== active || active.abort.signal.aborted) return;
    const delta = compareSnapshots(before, after);
    const attribution = active.grouped ? "grouped" : active.unverified || active.users !== 1 ? "unverified" : "individual";
    const status = aborted || active.outcome === "aborted" ? "cancelled" : active.outcome === "error" ? "failed" :
      delta.status === "partial" || attribution === "unverified" ? "partial" : "complete";
    const window: CapturedWindow = { id: active.id, attribution, status, inputCount: active.inputs, before, after, delta };
    this.active = undefined;
    this.current = attribution === "individual" && status === "complete" ? { state: "individual", window } :
      { state: "unavailable", reason: attribution === "grouped" ? "grouped-window" : status === "complete" ? "unverified" : status, window };
  }
}
