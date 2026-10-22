import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { getModel } from "@earendil-works/pi-ai/compat";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { AssistantMessage, ToolCall } from "@earendil-works/pi-ai";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";

// Local stream replaces only model output; Pi's loop, queues, retry and tools are real.
for (const scenario of ["tools", "steer", "followUp", "retry", "abort"] as const) {
  test(`M0 runtime lifecycle: ${scenario}`, { timeout: 15000 }, async () => {
    const cwd = await mkdtemp(join(tmpdir(), "pi-m0-lifecycle-"));
    await chmod(cwd, 0o700);
    let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
    try {
      const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: true, maxRetries: 1, baseDelayMs: 1 } });
      const resourceLoader = new DefaultResourceLoader({ cwd, agentDir: cwd, settingsManager,
        noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
      await resourceLoader.reload();
      const modelRuntime = await ModelRuntime.create({ authPath: join(cwd, "auth.json"), modelsPath: join(cwd, "models.json") });
      await modelRuntime.setRuntimeApiKey("openai", "local-test-not-a-secret");
      const model = getModel("openai", "gpt-4o-mini");
      assert.ok(model);
      ({ session } = await createAgentSession({ cwd, agentDir: cwd, resourceLoader, settingsManager, modelRuntime, model,
        sessionManager: SessionManager.inMemory(cwd), tools: ["write", "edit", "bash"] }));
      const trace: string[] = [];
      session.subscribe(event => {
        if (["agent_start", "turn_start", "turn_end", "agent_end", "queue_update", "auto_retry_start", "auto_retry_end"].includes(event.type)) trace.push(event.type);
        if (event.type === "tool_execution_start" || event.type === "tool_execution_end") trace.push(`${event.type}:${event.toolName}`);
        if (event.type === "agent_settled") trace.push(`agent_settled:${event.aborted}`);
      });
      let calls = 0;
      const userCounts: number[] = [];
      let entered!: () => void;
      const started = new Promise<void>(resolve => { entered = resolve; });
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      session.agent.streamFunction = (_model, context, options) => {
        userCounts.push(context.messages.filter(message => message.role === "user").length);
        const stream = createAssistantMessageEventStream();
        const call = ++calls;
        void (async () => {
          if (call === 1 && ["steer", "followUp", "abort"].includes(scenario)) {
            entered();
            await Promise.race([gate, new Promise<void>(resolve => options?.signal?.addEventListener("abort", () => resolve(), { once: true }))]);
          }
          const aborted = options?.signal?.aborted;
          const error = scenario === "retry" && call === 1;
          const tools: Pick<ToolCall, "name" | "arguments">[] = [
            { name: "write", arguments: { path: "m0.txt", content: "one" } },
            { name: "edit", arguments: { path: "m0.txt", oldText: "one", newText: "two" } },
            { name: "bash", arguments: { command: "printf three > m0.txt" } },
          ];
          const tool = scenario === "tools" ? tools[call - 1] : undefined;
          const message: AssistantMessage = { role: "assistant", api: model.api, provider: model.provider, model: model.id,
            timestamp: Date.now(), content: tool ? [{ type: "toolCall", id: `call-${call}`, ...tool }] : [{ type: "text", text: "done" }],
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            stopReason: aborted ? "aborted" : error ? "error" : tool ? "toolUse" : "stop",
            ...(error ? { errorMessage: "429 rate limit exceeded" } : {}) };
          if (aborted || error) stream.push({ type: "error", reason: aborted ? "aborted" : "error", error: message });
          else stream.push({ type: "done", reason: tool ? "toolUse" : "stop", message });
          stream.end();
        })();
        return stream;
      };
      const running = session.prompt("synthetic request");
      if (["steer", "followUp", "abort"].includes(scenario)) {
        await started;
        if (scenario === "abort") await session.abort();
        else {
          assert.equal(await session[scenario === "steer" ? "steer" : "followUp"]("synthetic queued request"), "queued");
          release();
        }
      }
      await running;
      await session.waitForIdle();
      assert.equal(trace.filter(e => e.startsWith("agent_settled:")).length, 1);
      assert.equal(trace.at(-1), `agent_settled:${scenario === "abort"}`);
      if (scenario === "tools") {
        assert.equal(calls, 4);
        assert.equal(await readFile(join(cwd, "m0.txt"), "utf8"), "three");
        for (const name of ["write", "edit", "bash"]) assert.ok(trace.includes(`tool_execution_end:${name}`));
        assert.equal(trace.filter(e => e === "turn_end").length, 4);
      }
      if (scenario === "retry") {
        assert.equal(calls, 2);
        assert.ok(trace.includes("auto_retry_start"));
        assert.ok(trace.includes("auto_retry_end"));
        assert.ok(trace.indexOf("agent_end") < trace.indexOf("auto_retry_start"));
      }
      if (scenario === "steer" || scenario === "followUp") {
        assert.equal(calls, 2);
        assert.ok(trace.includes("queue_update"));
        assert.equal(session.messages.filter(m => m.role === "user").length, 2);
        assert.deepEqual(userCounts, [1, 2], "queued input reaches the next model request, not the first");
      }
      console.log(`M0 ${scenario}: ${trace.join(" → ")}`);
      if (scenario === "abort") {
        trace.length = 0;
        await session.prompt("synthetic recovery request");
        assert.equal(trace.at(-1), "agent_settled:false");
        assert.equal(calls, 2);
      }
    } finally {
      session?.dispose();
      await rm(cwd, { recursive: true, force: true });
    }
  });
}
