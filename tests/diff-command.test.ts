import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager, type AgentSession, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { fuzzyFilter } from "@earendil-works/pi-tui";
import iterationDiff from "../src/index.js";
import { workspace } from "./fixtures/workspace.js";

for (const conflict of [false, true]) {
  test(`real SDK command registration preserves foreign /diff: conflict=${conflict}`, async () => {
    const w = await workspace();
    let session: AgentSession | undefined;
    let foreignCalls = 0;
    try {
      const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false } });
      const resourceLoader = new DefaultResourceLoader({ cwd: w.root, agentDir: w.root, settingsManager,
        noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
        // Foreign command loads AFTER our factory; session_start sees all extensions.
        extensionFactories: [iterationDiff, ...(conflict ? [(pi: ExtensionAPI) => {
          pi.registerCommand("diff", { handler: async () => { foreignCalls++; } });
        }] : [])] });
      await resourceLoader.reload();
      const modelRuntime = await ModelRuntime.create({ authPath: join(w.root, "auth.json"), modelsPath: join(w.root, "models.json"), refreshOnCreate: false, allowModelNetwork: false });
      ({ session } = await createAgentSession({ cwd: w.root, agentDir: w.root, resourceLoader, settingsManager,
        modelRuntime, sessionManager: SessionManager.inMemory(w.root), tools: [] }));
      await session.bindExtensions({ mode: "print", onError: error => assert.fail(JSON.stringify(error)) });
      assert.equal(session.extensionRunner.getCommand("iteration-diff"), undefined);
      assert.ok(session.extensionRunner.getCommand("diff-settings"));
      assert.ok(session.extensionRunner.getCommand("diff"));
      assert.equal(session.extensionRunner.getCommand("diff:1"), undefined, "no ambiguous aliases created");
      await session.prompt("/diff");
      assert.equal(foreignCalls, conflict ? 1 : 0);
      await session.reload();
      assert.ok(session.extensionRunner.getCommand("diff"));
      assert.equal(session.extensionRunner.getCommand("diff:1"), undefined);
    } finally { session?.dispose(); await w.close(); }
  });
}

test("command registration orders /diff before /diff-settings so /dif autocomplete prioritizes diff", async () => {
  const w = await workspace();
  let session: AgentSession | undefined;
  try {
    const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false } });
    const resourceLoader = new DefaultResourceLoader({
      cwd: w.root,
      agentDir: w.root,
      settingsManager,
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
      extensionFactories: [iterationDiff],
    });
    await resourceLoader.reload();
    const modelRuntime = await ModelRuntime.create({ authPath: join(w.root, "auth.json"), modelsPath: join(w.root, "models.json"), refreshOnCreate: false, allowModelNetwork: false });
    ({ session } = await createAgentSession({
      cwd: w.root,
      agentDir: w.root,
      resourceLoader,
      settingsManager,
      modelRuntime,
      sessionManager: SessionManager.inMemory(w.root),
      tools: [],
    }));
    await session.bindExtensions({ mode: "print", onError: error => assert.fail(JSON.stringify(error)) });

    // 1. Registered commands order in extensionRunner
    const registered = session.extensionRunner.getRegisteredCommands().map(c => c.name);
    const diffIdx = registered.indexOf("diff");
    const diffSettingsIdx = registered.indexOf("diff-settings");
    assert.ok(diffIdx !== -1, "diff must be registered");
    assert.ok(diffSettingsIdx !== -1, "diff-settings must be registered");
    assert.ok(diffIdx < diffSettingsIdx, "diff must precede diff-settings in registration order");

    // 2. Autocomplete fuzzy filter on prefix 'dif' preserves diff first
    const matches = fuzzyFilter(
      registered.map(name => ({ name })),
      "dif",
      i => i.name,
    ).map(i => i.name);
    assert.deepEqual(matches.filter(n => n === "diff" || n === "diff-settings"), ["diff", "diff-settings"]);
  } finally {
    session?.dispose();
    await w.close();
  }
});
