import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { registerCaptureLifecycle } from "../src/lifecycle/pi-lifecycle.js";
import type { IterationCapture } from "../src/lifecycle/iteration-capture.js";
import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";

type Session = Awaited<ReturnType<typeof createAgentSession>>["session"];

async function waitUntil(check: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 150; i++) {
    if (await check()) return;
    await delay(20);
  }
  assert.fail("condition not reached within 3 seconds");
}

async function stopped(pid: number): Promise<boolean> {
  try {
    // Linux zombies have exited but can await reaping by the container's init.
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    return stat.slice(stat.lastIndexOf(")") + 2).startsWith("Z");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
}

for (const scenario of ["http-retry", "bash-abort", "restore"] as const) {
  test(`M0 real HTTP lifecycle: ${scenario}`, { timeout: 20000 }, async () => {
    const cwd = await mkdtemp(join(tmpdir(), "pi-m0-http-"));
    await chmod(cwd, 0o700);
    const sessions: Session[] = [];
    const captures: IterationCapture[] = [];
    let requests = 0;
    const statuses: number[] = [];
    const paths: string[] = [];
    const childPids: number[] = [];
    const server = createServer((request, response) => {
      // Consume without recording request contents or authorization headers.
      request.resume();
      requests++;
      paths.push(request.url ?? "");
      if (scenario === "http-retry" && requests === 1) {
        statuses.push(429);
        response.writeHead(429, { "content-type": "application/json", "retry-after": "0" });
        response.end(JSON.stringify({ error: { message: "rate limit exceeded", type: "rate_limit_error", code: "rate_limit_exceeded" } }));
        return;
      }
      statuses.push(200);
      const toolCall = scenario === "bash-abort" && requests === 1;
      const delta = toolCall ? { tool_calls: [{ index: 0, id: "call-bash", type: "function", function: {
        name: "bash", arguments: JSON.stringify({ command: "printf '%s' $$ > shell.pid; sleep 30 & child=$!; printf '%s' \"$child\" > child.pid; wait \"$child\"; printf forbidden > after.txt" }),
      } }] } : { content: "done" };
      response.writeHead(200, { "content-type": "text/event-stream" });
      for (const chunk of [
        { choices: [{ index: 0, delta: { role: "assistant", ...delta }, finish_reason: null }] },
        { choices: [{ index: 0, delta: {}, finish_reason: toolCall ? "tool_calls" : "stop" }] },
      ]) response.write(`data: ${JSON.stringify({ id: "m0-local", object: "chat.completion.chunk", created: 1, model: "m0-local", ...chunk })}\n\n`);
      response.end("data: [DONE]\n\n");
    });
    try {
      execFileSync("git", ["-C", cwd, "init", "-q"]);
      await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const modelRuntime = await ModelRuntime.create({ authPath: join(cwd, "auth.json"), modelsPath: join(cwd, "models.json"), refreshOnCreate: false, allowModelNetwork: false });
      modelRuntime.registerProvider("m0-local", {
        baseUrl: `http://127.0.0.1:${address.port}/v1`, api: "openai-completions", apiKey: "local-test-not-a-secret",
        models: [{ id: "m0-local", name: "M0 local fixture", reasoning: false, input: ["text"], contextWindow: 32000, maxTokens: 64,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }],
      });
      const model = modelRuntime.getModel("m0-local", "m0-local");
      assert.ok(model);
      const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false },
        retry: { enabled: true, maxRetries: 1, baseDelayMs: 1, provider: { maxRetries: 0 } } });
      const hooks: string[] = [];
      const open = async (manager: SessionManager): Promise<Session> => {
        const resourceLoader = new DefaultResourceLoader({ cwd, agentDir: cwd, settingsManager, noExtensions: true,
          noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
          extensionFactories: [pi => {
            captures.push(registerCaptureLifecycle(pi, { exclude: ["sessions"] }));
            pi.on("session_start", () => { hooks.push("session_start"); });
            pi.on("input", () => { hooks.push("input"); });
            pi.on("before_agent_start", () => { hooks.push("before_agent_start"); });
            pi.on("agent_before_settle", () => { hooks.push("agent_before_settle"); });
            pi.on("agent_settled", event => { hooks.push(`agent_settled:${event.aborted}`); });
          }] });
        await resourceLoader.reload();
        const { session } = await createAgentSession({ cwd, agentDir: cwd, modelRuntime, model, settingsManager, resourceLoader,
          sessionManager: manager, tools: ["bash"] });
        sessions.push(session);
        await session.bindExtensions({ mode: "print" });
        return session;
      };
      let session = await open(scenario === "restore" ? SessionManager.create(cwd, join(cwd, "sessions")) : SessionManager.inMemory(cwd));
      const trace: string[] = [];
      const observe = (target: Session): void => { target.subscribe(event => {
        if (["agent_start", "turn_start", "turn_end", "agent_end", "auto_retry_start", "auto_retry_end", "tool_execution_start", "tool_execution_end"].includes(event.type)) trace.push(event.type);
        if (event.type === "agent_settled") trace.push(`agent_settled:${event.aborted}`);
      }); };
      observe(session);
      const running = session.prompt("synthetic HTTP fixture request");
      if (scenario === "bash-abort") {
        await waitUntil(async () => {
          try { return (await readFile(join(cwd, "child.pid"), "utf8")).length > 0; }
          catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
        });
        for (const file of ["shell.pid", "child.pid"]) {
          const pid = Number(await readFile(join(cwd, file), "utf8"));
          assert.ok(Number.isInteger(pid) && pid > 1);
          childPids.push(pid);
        }
        await session.abort();
      }
      await running;
      await session.waitForIdle();
      assert.equal(trace.at(-1), `agent_settled:${scenario === "bash-abort"}`);
      if (scenario === "http-retry") {
        assert.deepEqual(statuses, [429, 200]);
        assert.equal(trace.filter(event => event === "agent_end").length, 2);
        assert.equal(trace.filter(event => event === "agent_settled:false").length, 1);
        assert.ok(trace.includes("auto_retry_start") && trace.includes("auto_retry_end"));
      }
      if (scenario === "bash-abort") {
        assert.ok(trace.includes("tool_execution_end"));
        assert.equal(requests, 1, "abort prevents another provider request before recovery");
        for (const pid of childPids) await waitUntil(() => stopped(pid));
        await assert.rejects(readFile(join(cwd, "after.txt")), { code: "ENOENT" });
        const interrupted = captures.at(-1)?.state;
        assert.ok(interrupted && "window" in interrupted && interrupted.window);
        assert.equal(interrupted.state, "unavailable");
        assert.equal(interrupted.window.status, "cancelled");
        assert.ok(interrupted.window.delta.changes.some(change => change.path === "shell.pid"));
        await session.prompt("synthetic recovery request");
        assert.equal(trace.at(-1), "agent_settled:false");
      }
      if (scenario === "restore") {
        const file = session.sessionFile;
        const id = session.sessionId;
        assert.ok(file);
        assert.ok(file.startsWith(cwd));
        session.dispose();
        const manager = SessionManager.open(file, join(cwd, "sessions"));
        session = await open(manager);
        observe(session);
        assert.equal(session.sessionId, id);
        assert.equal(session.messages.filter(message => message.role === "user").length, 1);
        assert.equal(session.getLastAssistantText(), "done");
        assert.equal(captures.at(-1)?.state.state, "unavailable", "resume must not recover ephemeral snapshots");
        await session.prompt("synthetic restored request");
        assert.equal(session.messages.filter(message => message.role === "user").length, 2);
        assert.equal(trace.at(-1), "agent_settled:false");
        const fresh = await open(SessionManager.create(cwd, join(cwd, "sessions")));
        assert.notEqual(fresh.sessionId, id);
        assert.equal(fresh.messages.filter(message => message.role === "user").length, 0);
        assert.equal(captures.at(-1)?.state.state, "unavailable");
        await fresh.prompt("synthetic new session request");
        await fresh.waitForIdle();
        const freshState = captures.at(-1)?.state;
        assert.ok(freshState?.state === "individual");
        assert.equal(freshState.window.id.sessionId, fresh.sessionId);
        const original = captures[0].state;
        assert.ok(original.state === "individual");
        assert.notEqual(freshState.window.id.runtimeEpoch, original.window.id.runtimeEpoch);
      }
      const completed = captures.at(-1)?.state;
      assert.ok(completed?.state === "individual");
      assert.equal(completed.window.status, "complete");
      assert.equal(completed.window.delta.changes.length, 0);
      assert.ok(paths.every(path => path === "/v1/chat/completions"));
      assert.deepEqual(hooks.slice(0, 3), ["session_start", "input", "before_agent_start"]);
      if (scenario === "http-retry") {
        assert.equal(hooks.filter(event => event === "before_agent_start").length, 1);
        assert.deepEqual(hooks.slice(-2), ["agent_before_settle", "agent_settled:false"]);
      }
      if (scenario === "restore") assert.equal(hooks.filter(event => event === "session_start").length, 3);
      console.log(`M0 ${scenario}: HTTP ${statuses.join("→")}; ${trace.join(" → ")}; hooks ${hooks.join(" → ")}`);
    } finally {
      for (const session of sessions) { await session.abort(); session.dispose(); }
      // On a failed assertion, stop only fixture processes still alive before deleting files.
      for (const pid of childPids) if (!(await stopped(pid))) {
        try { process.kill(pid, "SIGKILL"); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
      }
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await rm(cwd, { recursive: true, force: true });
    }
  });
}
