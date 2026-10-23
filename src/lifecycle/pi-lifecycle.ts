import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { workspaceRoot, type CaptureLimits } from "../snapshots/capture.js";
import { inputFingerprint, IterationCapture } from "./iteration-capture.js";

/** Public Pi 1.4.0 events only; no editor, layout, session-log or Herdr writes. */
export function registerCaptureLifecycle(pi: ExtensionAPI, limits: Partial<CaptureLimits> = {}): IterationCapture {
  const controller = new IterationCapture(limits);
  let key: string | undefined;
  let generation = 0;
  let resolving: Promise<boolean> | undefined;
  const contextKey = (ctx: ExtensionContext): string => JSON.stringify([ctx.sessionManager.getSessionId(), ctx.cwd]);
  const invalidate = (reason: string): void => {
    generation++;
    resolving = undefined;
    key = undefined;
    controller.invalidate(reason);
  };
  const synchronize = async (ctx: ExtensionContext): Promise<boolean> => {
    const nextKey = contextKey(ctx);
    if (nextKey !== key) { invalidate("session-or-workspace-changed"); key = nextKey; }
    if (resolving) return resolving;
    const version = generation;
    const job = (async (): Promise<boolean> => {
      try {
        const root = await workspaceRoot(ctx.cwd);
        if (version !== generation || key !== nextKey) return false;
        controller.setScope({ sessionId: ctx.sessionManager.getSessionId(), root });
        return true;
      } catch {
        if (version === generation) controller.invalidate("workspace-unavailable");
        return false;
      }
    })();
    resolving = job;
    try { return await job; }
    finally { if (resolving === job) resolving = undefined; }
  };

  pi.on("session_start", async (_event, ctx) => {
    invalidate("session-start");
    await synchronize(ctx);
  });
  pi.on("session_shutdown", () => { invalidate("session-shutdown"); });
  pi.on("input", async (event, ctx) => {
    if (await synchronize(ctx)) await controller.input(event.text, ctx.isIdle(), event.source, !!event.streamingBehavior, !!event.images?.length);
  });
  pi.on("before_agent_start", async (event, ctx) => {
    if (await synchronize(ctx)) await controller.beforeStart(event.messageType === "user" ? event.prompt : undefined);
  });
  pi.on("message_start", (event, ctx) => {
    if (key !== contextKey(ctx)) { invalidate("session-or-workspace-changed"); return; }
    if (event.message.role !== "user") return;
    const content = event.message.content;
    const text = typeof content === "string" ? content : content.every(part => part.type === "text") ?
      content.map(part => part.type === "text" ? part.text : "").join("") : undefined;
    controller.userMessage(text === undefined ? undefined : inputFingerprint(text));
  });
  pi.on("turn_end", event => { controller.outcome(event.outcome); });
  pi.on("agent_before_settle", event => { controller.outcome(event.outcome); });
  pi.on("agent_settled", async (event, ctx) => {
    if (await synchronize(ctx)) await controller.settled(event.aborted);
  });
  return controller;
}
