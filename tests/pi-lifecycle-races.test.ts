import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionAPI, ExtensionContext, ExtensionEvent } from "@earendil-works/pi-coding-agent";
import { registerCaptureLifecycle } from "../src/lifecycle/pi-lifecycle.js";
import { workspace } from "./fixtures/workspace.js";

test("input synchronized before shutdown cannot overwrite the invalidated state", async () => {
  const w = await workspace();
  try {
    // Minimal event-dispatch fixture; only the public fields used by the adapter exist.
    const handlers = new Map<string, (event: never, ctx: ExtensionContext) => unknown>();
    const pi = { on(name: string, handler: (event: never, ctx: ExtensionContext) => unknown) {
      handlers.set(name, handler);
      return () => handlers.delete(name);
    } } as unknown as ExtensionAPI;
    let lookups = 0;
    let shutdown = false;
    const ctx = { cwd: w.root, isIdle: () => true, sessionManager: { getSessionId() {
      if (++lookups === 2) queueMicrotask(() => {
        shutdown = true;
        dispatch({ type: "session_shutdown", reason: "reload" });
      });
      return "session-a";
    } } } as unknown as ExtensionContext;
    const dispatch = (event: ExtensionEvent): unknown => handlers.get(event.type)?.(event as never, ctx);
    const capture = registerCaptureLifecycle(pi);
    await dispatch({ type: "input", text: "obsolete", source: "interactive" });
    assert.ok(shutdown, "shutdown interleaved between scope resolution and input continuation");
    assert.deepEqual(capture.state, { state: "unavailable", reason: "session-shutdown" });
  } finally { await w.close(); }
});
