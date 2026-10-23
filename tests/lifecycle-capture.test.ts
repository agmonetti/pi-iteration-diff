import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { Type } from "typebox";
import { getModel } from "@earendil-works/pi-ai/compat";
import { createAssistantMessageEventStream, type AssistantMessage, type ToolCall } from "@earendil-works/pi-ai";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { registerCaptureLifecycle } from "../src/lifecycle/pi-lifecycle.js";
import type { IterationCapture } from "../src/lifecycle/iteration-capture.js";
import { workspace } from "./fixtures/workspace.js";

type Session = Awaited<ReturnType<typeof createAgentSession>>["session"];

for (const scenario of ["tools", "steer", "followUp", "retry", "abort", "error", "consumed", "transformed", "preflight"] as const) {
  test(`M1 SDK capture: ${scenario}`, { timeout: 20000 }, async () => {
    const w = await workspace();
    let session: Session | undefined;
    let controller!: IterationCapture;
    let calls = 0;
    let consumed = false;
    try {
      await w.write("existing.txt", "preexisting user changes");
      await w.git("add", "--", "existing.txt");
      await w.write("existing.txt", "unstaged before run");
      const index = await readFile(join(w.root, ".git/index"));
      const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: true, maxRetries: 1, baseDelayMs: 1 } });
      const resourceLoader = new DefaultResourceLoader({ cwd: w.root, agentDir: w.root, settingsManager,
        noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
        extensionFactories: [pi => {
          controller = registerCaptureLifecycle(pi);
          pi.registerTool({ name: "custom_write", label: "fixture", description: "fixture custom writer", parameters: Type.Object({}),
            async execute() { await w.write("custom.txt", "custom tool"); return { content: [{ type: "text", text: "done" }], details: undefined }; } });
          pi.on("input", () => {
            if (scenario === "consumed" && !consumed) { consumed = true; return { action: "handled" }; }
            if (scenario === "transformed") return { action: "transform", text: "transformed synthetic input" };
          });
        }] });
      await resourceLoader.reload();
      const modelRuntime = await ModelRuntime.create({ authPath: join(w.root, "auth.json"), modelsPath: join(w.root, "models.json"), refreshOnCreate: false, allowModelNetwork: false });
      await modelRuntime.setRuntimeApiKey("openai", "local-test-not-a-secret");
      const model = getModel("openai", "gpt-4o-mini");
      assert.ok(model);
      ({ session } = await createAgentSession({ cwd: w.root, agentDir: w.root, resourceLoader, settingsManager, modelRuntime,
        model, sessionManager: SessionManager.inMemory(w.root), tools: ["write", "edit", "bash", "custom_write"] }));
      await session.bindExtensions({ mode: "print" });
      let entered!: () => void;
      const started = new Promise<void>(r => { entered = r; });
      let release!: () => void;
      const gate = new Promise<void>(r => { release = r; });
      session.agent.streamFunction = (_model, _context, options) => {
        const stream = createAssistantMessageEventStream();
        const call = ++calls;
        void (async () => {
          if (call === 1) {
            assert.equal(controller.state.state, "capturing", "baseline confirmed before model can write");
            await w.write("observed.txt", "external process in window");
            if (["steer", "followUp", "abort"].includes(scenario)) {
              entered();
              await Promise.race([gate, new Promise<void>(r => options?.signal?.addEventListener("abort", () => r(), { once: true }))]);
            }
          }
          const tools: Pick<ToolCall, "name" | "arguments">[] = [
            { name: "write", arguments: { path: "existing.txt", content: "one" } },
            { name: "edit", arguments: { path: "existing.txt", oldText: "one", newText: "two" } },
            { name: "bash", arguments: { command: "printf final > existing.txt; printf created > new.txt" } },
            { name: "custom_write", arguments: {} },
          ];
          const tool = scenario === "tools" ? tools[call - 1] : undefined;
          const error = scenario === "error" || scenario === "retry" && call === 1;
          const aborted = !!options?.signal?.aborted;
          const message: AssistantMessage = { role: "assistant", api: model.api, provider: model.provider, model: model.id, timestamp: Date.now(),
            content: tool ? [{ type: "toolCall", id: `m1-${call}`, ...tool }] : [{ type: "text", text: "done" }],
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            stopReason: aborted ? "aborted" : error ? "error" : tool ? "toolUse" : "stop",
            ...(error ? { errorMessage: scenario === "retry" ? "429 rate limit exceeded" : "non-retryable fixture failure" } : {}) };
          if (aborted || error) stream.push({ type: "error", reason: aborted ? "aborted" : "error", error: message });
          else stream.push({ type: "done", reason: tool ? "toolUse" : "stop", message });
          stream.end();
        })();
        return stream;
      };
      if (scenario === "preflight") {
        await modelRuntime.removeRuntimeApiKey("openai");
        await assert.rejects(session.prompt("failed preflight"));
        assert.equal(controller.state.state, "unavailable");
        assert.ok(!controller.state.window);
        await modelRuntime.setRuntimeApiKey("openai", "local-test-not-a-secret");
      }
      const running = session.prompt("synthetic request");
      if (["steer", "followUp", "abort"].includes(scenario)) {
        await started;
        if (scenario === "abort") await session.abort();
        else { await session[scenario === "steer" ? "steer" : "followUp"]("queued request"); release(); }
      }
      await running;
      await session.waitForIdle();
      if (scenario === "consumed") {
        assert.equal(calls, 0);
        assert.equal(controller.state.state, "unavailable");
        assert.ok(!controller.state.window);
        await session.prompt("synthetic accepted request");
        await session.waitForIdle();
      }
      const state = controller.state;
      assert.ok("window" in state && state.window, "expected a finalized observable window");
      const result = state.window;
      assert.equal(result.id.sessionId, session.sessionId);
      assert.equal(result.id.root, w.root);
      if (scenario === "steer" || scenario === "followUp") {
        assert.equal(state.state, "unavailable"); assert.equal(result.attribution, "grouped"); assert.equal(result.inputCount, 2);
      } else if (scenario === "transformed") {
        assert.equal(state.state, "unavailable"); assert.equal(result.attribution, "unverified");
      } else if (scenario === "abort" || scenario === "error") {
        assert.equal(state.state, "unavailable"); assert.equal(result.status, scenario === "abort" ? "cancelled" : "failed");
      } else {
        assert.equal(state.state, "individual"); assert.equal(result.status, "complete");
      }
      if (scenario === "tools") {
        assert.deepEqual(result.delta.changes.map(c => c.path), ["custom.txt", "existing.txt", "new.txt", "observed.txt"]);
        assert.equal(result.delta.changes.find(c => c.path === "existing.txt")?.before?.toString(), "unstaged before run");
        assert.equal(result.delta.changes.find(c => c.path === "existing.txt")?.after?.toString(), "final");
      }
      if (scenario === "retry") assert.equal(calls, 2);
      if (!["error", "transformed"].includes(scenario)) {
        await session.prompt("second isolated request");
        await session.waitForIdle();
        const second = controller.state;
        assert.equal(second.state, "individual");
        assert.equal(second.window.status, "complete");
        assert.equal(second.window.delta.changes.length, 0, "prior edits stay out of next iteration");
        assert.ok(second.window.id.sequence > result.id.sequence);
      }
      const previousEpoch = result.id.runtimeEpoch;
      const previousController = controller;
      await session.reload();
      assert.equal(previousController.state.state, "unavailable");
      assert.equal(controller.state.state, "unavailable");
      assert.ok(!controller.state.window);
      assert.deepEqual(await readFile(join(w.root, ".git/index")), index);
      assert.ok(previousEpoch);
    } finally { await session?.abort(); session?.dispose(); await w.close(); }
  });
}
