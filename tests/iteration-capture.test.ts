import assert from "node:assert/strict";
import { test } from "node:test";
import { IterationCapture, inputFingerprint } from "../src/lifecycle/iteration-capture.js";
import type { Snapshot } from "../src/snapshots/model.js";

function snapshot(value = "before"): Snapshot {
  return { root: "/fixture", files: new Map([["file", Buffer.from(value)]]), omitted: new Map(), enumerationComplete: true,
    issues: [], bytes: value.length, startedAt: 0, finishedAt: 1 };
}
function controller(): IterationCapture {
  let calls = 0;
  const capture = new IterationCapture({}, async () => snapshot(++calls % 2 ? "before" : "after"));
  capture.setScope({ sessionId: "session", root: "/fixture" });
  return capture;
}
async function begin(capture: IterationCapture): Promise<void> {
  await capture.input("request", true, "interactive", false);
  await capture.beforeStart("request");
  capture.userMessage(inputFingerprint("request"));
}

test("candidate input does not publish; confirmed request exposes only its complete delta", async () => {
  const capture = controller();
  await capture.input("consumed", true, "interactive", false);
  assert.equal(capture.state.state, "unavailable");
  await capture.settled(false);
  assert.equal(capture.state.state, "unavailable");
  await begin(capture);
  assert.equal(String(capture.state.state), "capturing");
  await capture.settled(false);
  const result = (() => capture.state)();
  assert.equal(result.state, "individual");
  assert.equal(result.window?.attribution, "individual");
});

test("late, transformed, custom and extension-sourced starts fail closed", async () => {
  for (const mode of ["late", "transformed", "custom", "extension", "images"] as const) {
    const capture = controller();
    if (mode !== "late") await capture.input("request", true, mode === "extension" ? "extension" : "interactive", false, mode === "images");
    await capture.beforeStart(mode === "custom" ? undefined : mode === "transformed" ? "expanded" : "request");
    capture.userMessage(inputFingerprint("request"));
    await capture.settled(false);
    assert.equal(capture.state.state, "unavailable", mode);
    assert.equal(capture.state.window?.attribution, "unverified", mode);
  }
});

test("abort/error, queued inputs and uncorrelated user messages cannot masquerade as individual success", async () => {
  for (const mode of ["abort", "error", "queued", "late-queue", "unknown-message"] as const) {
    const capture = controller();
    await begin(capture);
    if (mode === "queued" || mode === "late-queue") await capture.input("queued", false, "interactive", true);
    if (mode === "late-queue" || mode === "unknown-message") capture.userMessage(inputFingerprint("other"));
    if (mode === "error") capture.outcome("error");
    await capture.settled(mode === "abort");
    assert.equal(capture.state.state, "unavailable", mode);
    assert.equal(capture.state.window?.status, mode === "abort" ? "cancelled" : mode === "error" ? "failed" : "complete");
    if (mode.includes("queue") || mode === "unknown-message") assert.equal(capture.state.window?.attribution, "grouped");
  }
});

test("partial endpoints and failed capture never become complete or empty success", async () => {
  for (const throwing of [false, true]) {
    const capture = new IterationCapture({}, async () => {
      if (throwing) throw new Error("do not expose contents");
      return { ...snapshot(), enumerationComplete: false, issues: ["timeout"] };
    });
    capture.setScope({ sessionId: "session", root: "/fixture" });
    await begin(capture);
    await capture.settled(false);
    assert.equal(capture.state.state, "unavailable");
    assert.equal(capture.state.window?.status, "partial");
    assert.equal(capture.state.window?.delta.status, "partial");
    assert.ok(!capture.state.window?.delta.issues.includes("do not expose contents"));
  }
});

test("scope invalidation synchronously aborts final capture and rejects stale publication", async () => {
  let resolve!: (snapshot: Snapshot) => void;
  let signal!: AbortSignal;
  let entered!: () => void;
  const finalStarted = new Promise<void>(r => { entered = r; });
  let calls = 0;
  const capture = new IterationCapture({}, async (_root, abort) => {
    if (++calls === 1) return snapshot();
    signal = abort;
    entered();
    return new Promise<Snapshot>(r => { resolve = r; });
  });
  capture.setScope({ sessionId: "session-a", root: "/fixture" });
  await begin(capture);
  const final = capture.settled(false);
  await finalStarted;
  capture.invalidate("shutdown");
  assert.ok(signal.aborted);
  capture.setScope({ sessionId: "session-b", root: "/fixture" });
  resolve(snapshot("stale"));
  await final;
  assert.equal(capture.state.state, "unavailable");
  assert.ok(!capture.state.window);
});

test("worktree root changes and a new runtime never reuse the previous identity", async () => {
  const capture = new IterationCapture({}, async root => ({ ...snapshot(), root }));
  capture.setScope({ sessionId: "same-session", root: "/worktree-a" });
  await begin(capture);
  await capture.settled(false);
  const first = capture.state;
  assert.ok(first.state === "individual");
  capture.setScope({ sessionId: "same-session", root: "/worktree-b" });
  assert.equal(String(capture.state.state), "unavailable");
  await begin(capture);
  await capture.settled(false);
  const second = (() => capture.state)();
  assert.ok(second.state === "individual");
  assert.equal(second.window.id.root, "/worktree-b");
  assert.ok(second.window.id.sequence > first.window.id.sequence);
  const restarted = new IterationCapture({}, async root => ({ ...snapshot(), root }));
  restarted.setScope({ sessionId: "same-session", root: "/worktree-b" });
  await begin(restarted);
  await restarted.settled(false);
  const fresh = restarted.state;
  assert.ok(fresh.state === "individual");
  assert.notEqual(fresh.window.id.runtimeEpoch, second.window.id.runtimeEpoch);
});

test("new scope waits for aborted IO; backend captures never overlap", async () => {
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>(r => { entered = r; });
  const gate = new Promise<void>(r => { release = r; });
  let calls = 0;
  let concurrent = 0;
  let peak = 0;
  const capture = new IterationCapture({}, async () => {
    const call = ++calls;
    peak = Math.max(peak, ++concurrent);
    if (call === 1) { entered(); await gate; }
    concurrent--;
    return snapshot();
  });
  capture.setScope({ sessionId: "a", root: "/fixture" });
  const old = capture.input("old", true, "interactive", false);
  await started;
  capture.setScope({ sessionId: "b", root: "/fixture" });
  const next = capture.input("request", true, "interactive", false);
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  await Promise.all([old, next]);
  await capture.beforeStart("request");
  capture.userMessage(inputFingerprint("request"));
  await capture.settled(false);
  assert.equal(peak, 1);
  const state = capture.state;
  assert.equal(state.state, "individual");
  assert.equal(state.window.id.sessionId, "b");
});

test("invalidating a pending baseline cannot resurrect it and duplicate settled cannot capture twice", async () => {
  let release!: (snapshot: Snapshot) => void;
  let entered!: () => void;
  const baselineStarted = new Promise<void>(r => { entered = r; });
  let calls = 0;
  const capture = new IterationCapture({}, async () => {
    if (++calls === 1) { entered(); return new Promise<Snapshot>(r => { release = r; }); }
    return snapshot();
  });
  capture.setScope({ sessionId: "a", root: "/fixture" });
  const input = capture.input("request", true, "interactive", false);
  await baselineStarted;
  capture.invalidate();
  release(snapshot());
  await input;
  await capture.beforeStart("request");
  assert.equal(capture.state.state, "unavailable");
  capture.setScope({ sessionId: "b", root: "/fixture" });
  await begin(capture);
  await Promise.all([capture.settled(false), capture.settled(false)]);
  assert.equal(calls, 3);
  assert.equal(capture.state.window?.id.sessionId, "b");
});
