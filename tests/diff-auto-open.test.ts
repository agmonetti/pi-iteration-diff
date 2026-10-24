import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { initTheme, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, ScrollView, TuiAltScreen, VStack, type Component, type Terminal } from "@earendil-works/pi-tui";
import iterationDiff from "../src/index.js";
import { DEFAULT_SETTINGS, SETTINGS_ENTRY } from "../src/ui/diff-settings.js";
import { ResizableDockRoot } from "../src/ui/layout-adapter.js";
import { workspace } from "./fixtures/workspace.js";

class TestTerminal implements Terminal {
  columns = 120; rows = 24; kittyProtocolActive = false;
  start(): void {} stop(): void {} async drainInput(): Promise<void> {}
  write(): void {} moveBy(): void {} hideCursor(): void {} showCursor(): void {}
  clearLine(): void {} clearFromCursor(): void {} clearScreen(): void {}
  setTitle(): void {} setProgress(): void {} setProgramStatus(): void {}
}

type Handler = (event: never, ctx: ExtensionContext) => unknown;
type Command = { handler: (args: string, ctx: ExtensionContext) => Promise<void> };
async function fixture(autoOpen: boolean) {
  initTheme("dark");
  const w = await workspace();
  const handlers = new Map<string, Handler[]>();
  const commands = new Map<string, Command>();
  const shortcuts = new Map<string, (ctx: ExtensionContext) => Promise<void>>();
  let entries = [{ type: "custom", customType: SETTINGS_ENTRY, data: { version: 1, ...DEFAULT_SETTINGS, autoOpen } }];
  let failPersistence = false;
  const notifications: string[] = [];
  const pi = {
    on(name: string, handler: Handler) { handlers.set(name, [...(handlers.get(name) ?? []), handler]); return () => {}; },
    registerCommand(name: string, command: Command) { commands.set(name, command); },
    registerShortcut(key: string, shortcut: { handler: (ctx: ExtensionContext) => Promise<void> }) { shortcuts.set(key, shortcut.handler); },
    getCommands: () => [...commands.keys()].map(name => ({ name })),
    appendEntry(customType: string, data: typeof entries[number]["data"]) {
      if (failPersistence) throw new Error("fixture storage failure");
      entries.push({ type: "custom", customType, data });
    },
  } as unknown as ExtensionAPI;
  const tui = new TuiAltScreen(new TestTerminal());
  const editor: Component = { invalidate() {}, render: () => ["draft"] };
  const chat = new Container();
  tui.addChild(chat); tui.addChild(editor);
  const native = new VStack([new ScrollView(chat), new VStack([editor])]);
  tui.setLayoutRoot(native); tui.setFocus(editor);
  let widget: (Component & { dispose?: () => void }) | undefined;
  let opens = 0;
  let draft = "existing draft";
  let writes = 0;
  let settingsKeys: string[] = [];
  const theme = { fg: (_r: string, text: string) => text, bg: (_r: string, text: string) => text, bold: (text: string) => text };
  const ctx = { cwd: w.root, mode: "tui", isIdle: () => true,
    sessionManager: { getSessionId: () => "test-session", getBranch: () => entries },
    ui: { theme,
      async custom(factory: (tui: TuiAltScreen, theme: unknown, keys: unknown, done: () => void) => Component) {
        let done = false;
        const component = factory(tui, theme, {}, () => { done = true; });
        for (const key of settingsKeys) component.handleInput?.(key);
        component.handleInput?.("\x1b");
        assert.ok(done);
      },
      notify(message: string) { notifications.push(message); }, getEditorText: () => draft, setEditorText(text: string) { writes++; draft = text; },
      setWidget(_id: string, factory?: (tui: TuiAltScreen) => Component & { dispose?: () => void }) {
        widget?.dispose?.(); widget = undefined;
        if (factory) { widget = factory(tui); opens++; }
      },
    },
  } as unknown as ExtensionContext;
  const dispatch = async (name: string, event: object = {}) => {
    for (const handler of handlers.get(name) ?? []) await handler(event as never, ctx);
  };
  iterationDiff(pi);
  await dispatch("session_start");
  let sequence = 0;
  return { ctx, tui, editor, commands, shortcuts, handlers, dispatch,
    opens: () => opens, writes: () => writes, draft: () => draft,
    entries: () => entries,
    failPersistence() { failPersistence = true; }, notifications,
    async settings(keys: string[]) { settingsKeys = keys; await commands.get("diff-settings")!.handler("", ctx); },
    async begin(grouped = false) {
      await dispatch("input", { text: "request", source: "interactive" });
      await dispatch("before_agent_start", { messageType: "user", prompt: "request" });
      await dispatch("message_start", { message: { role: "user", content: "request" } });
      if (grouped) await dispatch("input", { text: "queued", source: "interactive", streamingBehavior: "followUp" });
      await writeFile(join(w.root, "change.txt"), String(++sequence));
    },
    async finish(aborted = false) { await dispatch("agent_settled", { aborted }); },
    setBranch(autoOpen: boolean) { entries = [{ type: "custom", customType: SETTINGS_ENTRY,
      data: { version: 1, ...DEFAULT_SETTINGS, autoOpen } }]; },
    async close() { await dispatch("session_shutdown"); await w.close(); },
  };
}

test("auto-open defaults Off; F6 opens/focuses and /diff toggles without the removed alias", async () => {
  const f = await fixture(false);
  try {
    await f.begin(); await f.finish(); assert.equal(f.opens(), 0);
    assert.equal(f.commands.has("iteration-diff"), false);
    await f.shortcuts.get("f6")!(f.ctx);
    assert.equal(f.opens(), 1); assert.notEqual(f.tui.getFocusedComponent(), f.editor);
    await f.commands.get("diff")!.handler("", f.ctx);
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    assert.equal(f.writes(), 0); assert.equal(f.draft(), "existing draft");
  } finally { await f.close(); }
});

test("opt-in opens only final individual results, preserves focus and respects manual closure until next iteration", async () => {
  const f = await fixture(true);
  try {
    await f.begin(); assert.equal(f.opens(), 0);
    await f.finish(); assert.equal(f.opens(), 1);
    await f.finish(); assert.equal(f.opens(), 1, "duplicate settled does not replace an open dock");
    assert.equal(f.tui.getFocusedComponent(), f.editor);
    await f.commands.get("diff")!.handler("", f.ctx);
    await f.finish(); assert.equal(f.opens(), 1);
    await f.begin();
    await f.commands.get("diff")!.handler("", f.ctx);
    await f.commands.get("diff")!.handler("", f.ctx);
    await f.finish(); assert.equal(f.opens(), 2, "manual close while capturing suppresses automatic reopen");
    await f.begin(); await f.finish(); assert.equal(f.opens(), 3);
    assert.equal(f.writes(), 0); assert.equal(f.draft(), "existing draft");
  } finally { await f.close(); }
});

for (const outcome of ["grouped", "aborted", "failed"] as const) {
  test(`auto-open rejects ${outcome} windows`, async () => {
    const f = await fixture(true);
    try {
      await f.begin(outcome === "grouped");
      if (outcome === "failed") await f.dispatch("turn_end", { outcome: "error" });
      await f.finish(outcome === "aborted");
      assert.equal(f.opens(), 0);
    } finally { await f.close(); }
  });
}

test("shutdown or branch change while automatic root validation awaits cannot mount stale UI", async () => {
  for (const action of ["session_shutdown", "session_tree"]) {
    const f = await fixture(true);
    try {
      await f.begin();
      const settled = f.handlers.get("agent_settled")!;
      await settled[0]!({ aborted: false } as never, f.ctx);
      const opening = settled[1]!({ aborted: false } as never, f.ctx);
      f.setBranch(false);
      await f.dispatch(action);
      await opening;
      assert.equal(f.opens(), 0);
    } finally { await f.close(); }
  }
});

test("explicit SettingsList consent persists; Off during pending automatic opening cancels it", async () => {
  const f = await fixture(false);
  const down = "\x1b[B";
  try {
    await f.settings([down, down, down, down, down, "\r"]);
    assert.equal(f.entries().at(-1)!.data.autoOpen, true);
    assert.equal(f.opens(), 0, "consent is not retroactive opening");
    await f.begin();
    const settled = f.handlers.get("agent_settled")!;
    await settled[0]!({ aborted: false } as never, f.ctx);
    const opening = settled[1]!({ aborted: false } as never, f.ctx);
    await f.settings([down, down, down, down, down, "\r"]);
    await opening;
    assert.equal(f.entries().at(-1)!.data.autoOpen, false);
    assert.equal(f.opens(), 0);
    assert.equal(f.writes(), 0);
  } finally { await f.close(); }
});

test("manual open then close supersedes pending automatic open", async () => {
  const f = await fixture(true);
  try {
    await f.begin();
    const settled = f.handlers.get("agent_settled")!;
    await settled[0]!({ aborted: false } as never, f.ctx);
    const opening = settled[1]!({ aborted: false } as never, f.ctx);
    await f.commands.get("diff")!.handler("", f.ctx);
    await f.commands.get("diff")!.handler("", f.ctx);
    await opening;
    await f.finish();
    assert.equal(f.opens(), 1);
    assert.equal(f.tui.getFocusedComponent(), f.editor);
  } finally { await f.close(); }
});

test("Remember width persists resize only when On; branch restoration resets defaults and consent", async () => {
  const f = await fixture(false);
  const ratio = () => (f.tui as unknown as { layoutRoot: ResizableDockRoot }).layoutRoot.dockRatio;
  try {
    await f.shortcuts.get("f6")!(f.ctx);
    f.tui.getFocusedComponent()!.handleInput!(">");
    const saved = ratio();
    assert.ok(saved > 0.45);
    assert.equal(f.entries().at(-1)!.data.dockWidth, saved * 100);
    await f.commands.get("diff")!.handler("", f.ctx);
    await f.shortcuts.get("f6")!(f.ctx);
    assert.equal(ratio(), saved);
    await f.settings(Array(4).fill("\x1b[B").concat("\r"));
    assert.equal(f.entries().at(-1)!.data.rememberWidth, false);
    const count = f.entries().length;
    f.tui.getFocusedComponent()!.handleInput!(">");
    assert.ok(ratio() > saved);
    await f.commands.get("diff")!.handler("", f.ctx);
    assert.equal(f.entries().length, count, "transient width was not persisted");
    await f.shortcuts.get("f6")!(f.ctx);
    assert.equal(ratio(), saved);
    f.setBranch(false);
    await f.dispatch("session_tree");
    await f.shortcuts.get("f6")!(f.ctx);
    assert.equal(ratio(), 0.45);
    f.failPersistence();
    f.tui.getFocusedComponent()!.handleInput!(">");
    await f.commands.get("diff")!.handler("", f.ctx);
    assert.equal(f.tui.getFocusedComponent(), f.editor, "storage failure cannot prevent cleanup");
    assert.ok(f.notifications.some(text => text.includes("could not be saved")));
    assert.equal(f.writes(), 0);
  } finally { await f.close(); }
});

test("layout updates dock width on hot settings change without altering editor draft", async () => {
  const f = await fixture(false);
  try {
    await f.begin();
    await f.finish();
    await f.shortcuts.get("f6")!(f.ctx);
    assert.equal(f.opens(), 1);

    const inspectedTui = f.tui as unknown as { layoutRoot: ResizableDockRoot };
    const root = inspectedTui.layoutRoot;
    assert.equal(root.dockRatio, 0.45);

    const initialDraft = f.draft();
    const initialWrites = f.writes();

    // Enter settings: item 0 is dockWidth. Enter edit mode (\r), left arrow twice (45% -> 43%), Enter (\r) confirms.
    await f.settings(["\r", "\x1b[D", "\x1b[D", "\r"]);

    // 1. Layout updated in-place
    assert.equal(root.dockRatio, 0.43);
    // 2. Editor draft completely unchanged
    assert.equal(f.draft(), initialDraft);
    assert.equal(f.writes(), initialWrites);
    // 3. Persisted to session branch
    assert.equal(f.entries().at(-1)!.data.dockWidth, 43);
  } finally {
    await f.close();
  }
});
