import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Container, ScrollView, TuiAltScreen, VStack,
  stripTerminalSequences, visibleWidth, type Component, type Terminal,
} from "@earendil-works/pi-tui";
import type { DiffRow, IterationView } from "../src/diffs/iteration-diff.js";
import {
  computeHunkIndent, compactLineText, DiffPanel, type Actions,
} from "../src/ui/diff-panel.js";
import iterationDiff from "../src/index.js";
import {
  nestedTsRows, pipelinePyRows, deploymentYamlRows, tabsGoRows, mixedAmbiguousRows,
  syntheticCompactedFiles, createModifiedWorkspace,
} from "./fixtures/compaction-fixtures.js";

function makeActions(renderCb = () => {}): Actions & { draft: string; editorCalls: number } {
  let draft = "";
  let editorCalls = 0;
  return {
    render: renderCb,
    close() {},
    editor() { editorCalls++; },
    style: (_role, text) => text,
    appendContext(snippet) { draft = draft ? `${draft}\n\n${snippet}` : snippet; },
    get draft() { return draft; },
    set draft(v: string) { draft = v; },
    get editorCalls() { return editorCalls; },
  };
}

function plain(panel: DiffPanel, width = 80): string[] {
  return panel.render(width).map(stripTerminalSequences);
}

function allLines(panel: DiffPanel, width = 80): string[] {
  const tp = panel as unknown as { diffEntries: unknown[]; entryLine: (i: number, w: number) => string };
  return tp.diffEntries.map((_, i) => stripTerminalSequences(tp.entryLine(i, width)));
}

test("computeHunkIndent calculates minimum common indentation among non-empty lines", () => {
  // TypeScript hunk 1: 12 spaces
  const tsHunk1 = nestedTsRows.slice(0, 8);
  const tsIndent1 = computeHunkIndent(tsHunk1);
  assert.deepEqual(tsIndent1, { kind: "spaces", count: 12 });

  // TypeScript hunk 2: top-level (0 spaces)
  const tsHunk2 = nestedTsRows.slice(8);
  const tsIndent2 = computeHunkIndent(tsHunk2);
  assert.equal(tsIndent2, undefined, "hunk with 0-indent line has no common indent");

  // Python hunk 1: 8 spaces
  const pyHunk1 = pipelinePyRows.slice(0, 7);
  const pyIndent1 = computeHunkIndent(pyHunk1);
  assert.deepEqual(pyIndent1, { kind: "spaces", count: 8 });

  // Python hunk 2: top-level (0 spaces)
  const pyHunk2 = pipelinePyRows.slice(7);
  assert.equal(computeHunkIndent(pyHunk2), undefined);

  // YAML hunk 1: 6 spaces
  const yamlHunk1 = deploymentYamlRows.slice(0, 9);
  const yamlIndent1 = computeHunkIndent(yamlHunk1);
  assert.deepEqual(yamlIndent1, { kind: "spaces", count: 6 });

  // YAML hunk 2: top-level (0 spaces)
  const yamlHunk2 = deploymentYamlRows.slice(9);
  assert.equal(computeHunkIndent(yamlHunk2), undefined);

  // Tabs Go hunk: 2 tabs
  const tabsIndent = computeHunkIndent(tabsGoRows);
  assert.deepEqual(tabsIndent, { kind: "tabs", count: 2 });
});

test("computeHunkIndent preserves original formatting under mixed or ambiguous indentation", () => {
  // Mixed tab and space lines in same hunk
  assert.equal(computeHunkIndent(mixedAmbiguousRows), undefined, "mixed tabs and spaces lines are ambiguous");

  // Single line with spaces then tab in leading whitespace
  const mixedPrefixRow: DiffRow[] = [
    { kind: "hunk", text: "@@ -1,2 +1,2 @@" },
    { kind: "added", newLine: 1, text: "  \tconst x = 1;" },
    { kind: "context", oldLine: 2, newLine: 2, text: "    const y = 2;" },
  ];
  assert.equal(computeHunkIndent(mixedPrefixRow), undefined, "line with mixed space-tab prefix is ambiguous");

  // Single line with tabs then space in leading whitespace
  const tabSpacePrefixRow: DiffRow[] = [
    { kind: "hunk", text: "@@ -1,2 +1,2 @@" },
    { kind: "added", newLine: 1, text: "\t const x = 1;" },
    { kind: "context", oldLine: 2, newLine: 2, text: "\t\tconst y = 2;" },
  ];
  assert.equal(computeHunkIndent(tabSpacePrefixRow), undefined, "line with tab-space prefix is ambiguous");

  // Empty or whitespace-only hunk
  const blankHunk: DiffRow[] = [
    { kind: "hunk", text: "@@ -1,2 +1,2 @@" },
    { kind: "added", newLine: 1, text: "" },
    { kind: "added", newLine: 2, text: "   " },
  ];
  assert.equal(computeHunkIndent(blankHunk), undefined, "all blank lines yield undefined");
});

test("compactLineText strips common prefix and preserves relative indentation and empty lines", () => {
  const indent12 = { kind: "spaces" as const, count: 12 };
  assert.equal(compactLineText("            if (authorized) {", indent12), "if (authorized) {");
  assert.equal(compactLineText("                return result;", indent12), "    return result;");
  assert.equal(compactLineText("", indent12), "");
  assert.equal(compactLineText("    ", indent12), "");
  assert.equal(compactLineText("            }", indent12), "}");

  // Relative indentation check: 16 spaces vs 12 spaces = 4 spaces relative
  const lineA = compactLineText("            base();", indent12);
  const lineB = compactLineText("                nested();", indent12);
  assert.equal(visibleWidth(lineB) - visibleWidth(lineA), visibleWidth("    nested();") - visibleWidth("base();"));

  // Tabs
  const indentTabs = { kind: "tabs" as const, count: 2 };
  assert.equal(compactLineText("\t\tif ready {", indentTabs), "if ready {");
  assert.equal(compactLineText("\t\t\tprocess();", indentTabs), "    process();", "remaining tab expands to 4 spaces");

  // Undefined indent leaves safeText intact
  assert.equal(compactLineText("  original", undefined), "  original");
});

test("DiffPanel renders original indentation in Mode A and compacted in Mode B", () => {
  const actions = makeActions();
  const panel = new DiffPanel(actions, { collapseFiles: false });
  const view: IterationView = {
    key: "compaction-view-1",
    title: "DIFF",
    notices: [],
    files: syntheticCompactedFiles,
  };
  panel.setView(view);

  // Default is Mode A (original indentation)
  assert.equal(panel.getCompactMode(), false, "default mode must be A (original)");
  const linesA = allLines(panel, 120);

  // Check TypeScript hunk 1 has 12 spaces in Mode A
  const tsLineA = linesA.find(l => l.includes("if (isAuthorized(session))"));
  assert.ok(tsLineA, "TS line must render");
  assert.ok(tsLineA.includes("            if (isAuthorized(session))"), "Mode A has original 12 spaces");

  // Check Python hunk 1 has 8 spaces in Mode A
  const pyLineA = linesA.find(l => l.includes("if dataset is not None:"));
  assert.ok(pyLineA);
  assert.ok(pyLineA.includes("        if dataset is not None:"), "Mode A has original 8 spaces");

  // Check YAML hunk 1 has 6 spaces in Mode A
  const yamlLineA = linesA.find(l => l.includes("containers:"));
  assert.ok(yamlLineA);
  assert.ok(yamlLineA.includes("      containers:"), "Mode A has original 6 spaces");

  // Switch to Mode B (compacted)
  panel.setCompactMode(true);
  assert.equal(panel.getCompactMode(), true);
  const linesB = allLines(panel, 120);

  // TS hunk 1 should have 0 spaces before "if", while relative 4 spaces remain on "const query"
  const tsLineB = linesB.find(l => l.includes("if (isAuthorized(session))"));
  assert.ok(tsLineB);
  assert.ok(!tsLineB.includes("            if"), "12 common spaces stripped");
  assert.ok(tsLineB.endsWith(" if (isAuthorized(session)) {"));

  const tsNestedB = linesB.find(l => l.includes("const query = buildQuery"));
  assert.ok(tsNestedB);
  assert.ok(tsNestedB.endsWith("     const query = buildQuery(filter);"), "relative 4 spaces preserved");

  // TS hunk 2 (0 common indent) must remain unchanged
  const tsHunk2A = linesA.find(l => l.includes("export function configureDefaults"));
  const tsHunk2B = linesB.find(l => l.includes("export function configureDefaults"));
  assert.equal(tsHunk2B, tsHunk2A, "hunk with 0 common indent is not changed");

  // Python hunk 1 should have 8 common spaces stripped
  const pyLineB = linesB.find(l => l.includes("if dataset is not None:"));
  assert.ok(pyLineB);
  assert.ok(pyLineB.endsWith(" if dataset is not None:"), "8 spaces stripped");

  const pyNestedB = linesB.find(l => l.includes("for item in dataset:"));
  assert.ok(pyNestedB);
  assert.ok(pyNestedB.endsWith("     for item in dataset:"), "relative 4 spaces preserved");

  // YAML hunk 1 should have 6 common spaces stripped
  const yamlLineB = linesB.find(l => l.includes("containers:"));
  assert.ok(yamlLineB);
  assert.ok(yamlLineB.endsWith(" containers:"), "6 spaces stripped");

  // Tabs Go hunk should have 2 tabs stripped
  const goLineA = linesA.find(l => l.includes("if ready {"));
  const goLineB = linesB.find(l => l.includes("if ready {"));
  assert.ok(goLineA?.includes("        if ready"), "Mode A expands 2 tabs to 8 spaces");
  assert.ok(goLineB?.endsWith(" if ready {"), "Mode B strips common tabs");

  // Ambiguous hunk preserves original formatting in Mode B
  const mixedA = linesA.find(l => l.includes("legacyTabIndent"));
  const mixedB = linesB.find(l => l.includes("legacyTabIndent"));
  assert.equal(mixedB, mixedA, "ambiguous hunk preserves original formatting");
});

test("keyboard shortcut 'c' toggles Mode A/B dynamically in place", () => {
  const actions = makeActions();
  const panel = new DiffPanel(actions, { collapseFiles: false });
  panel.setView({
    key: "toggle-test",
    title: "DIFF",
    notices: [],
    files: [syntheticCompactedFiles[0]!],
  });

  assert.equal(panel.getCompactMode(), false);
  assert.ok(plain(panel, 80).some(l => l.includes("            if (isAuthorized")));

  // Press 'c' to toggle to Mode B
  panel.handleInput("c");
  assert.equal(panel.getCompactMode(), true);
  assert.ok(plain(panel, 80).some(l => l.endsWith(" if (isAuthorized(session)) {")));

  // Footer indicates Mode B
  const footerB = panel.render(80)[panel.render(80).length - 1]!;
  assert.ok(footerB.includes("[B: compact]"), "footer shows B compact mode indicator");

  // Press 'c' again to toggle back to Mode A
  panel.handleInput("c");
  assert.equal(panel.getCompactMode(), false);
  assert.ok(plain(panel, 80).some(l => l.includes("            if (isAuthorized")));
  const footerA = panel.render(80)[panel.render(80).length - 1]!;
  assert.ok(!footerA.includes("[B: compact]"), "footer omits B mode indicator in Mode A");
});

test("horizontal scroll operates over visually compacted text in Mode B", () => {
  const actions = makeActions();
  const panel = new DiffPanel(actions, { collapseFiles: false });
  panel.setView({
    key: "pan-compaction-test",
    title: "DIFF",
    notices: [],
    files: [syntheticCompactedFiles[0]!], // nested.ts
  });
  panel.setCompactMode(true);

  // In narrow width (e.g. 40 columns), long compacted lines overflow and show '»'
  const linesNarrow = plain(panel, 40);
  const rowLine = linesNarrow.find(l => l.includes("const result = await mode"));
  assert.ok(rowLine, "modified line rendered");
  assert.ok(rowLine.endsWith("»"), "right overflow indicator visible on long line");

  // Pan right by 8 columns using 'l'
  panel.handleInput("l");
  const linesPanned = plain(panel, 40);
  const pannedRow = linesPanned.find(l => l.includes("result = await mode"));
  assert.ok(pannedRow, "panned line rendered");
  assert.ok(pannedRow.includes("«"), "left overflow indicator '«' visible after pan");

  // Pan back with 'h'
  panel.handleInput("h");
  const linesReset = plain(panel, 40);
  assert.ok(!linesReset.find(l => l.includes("result = await mode"))?.includes("«"), "pan returned to start");
});

test("selection and context appending preserve 100% original indentation in Mode B", () => {
  const actions = makeActions();
  const panel = new DiffPanel(actions, { collapseFiles: false });
  panel.setView({
    key: "context-test",
    title: "DIFF",
    notices: [],
    files: [syntheticCompactedFiles[0]!], // nested.ts
  });

  // Select hunk 1 in Mode A and get context
  panel.handleInput("\x1b[B"); // moves to hunk header 1
  panel.handleInput("\r");     // select whole hunk
  const contextA = panel.formatSelectedContext();
  assert.ok(contextA, "context A formatted");
  assert.ok(contextA.includes("-                const result = await legacyFetch"), "Mode A has 16 original spaces");
  assert.ok(contextA.includes("+                const result = await modernFetch"), "Mode A has 16 original spaces");

  // Now switch to Mode B
  panel.setCompactMode(true);
  const contextB = panel.formatSelectedContext();
  assert.equal(contextB, contextA, "context formatted in Mode B is byte-identical to Mode A");

  // Append context via 'a'
  panel.handleInput("a");
  assert.equal(actions.draft, contextA, "appended draft has 100% original indentation intact");
  assert.equal(actions.editorCalls, 1, "editor focused after context transfer");

  // Keyboard range selection with Shift+Down in Mode B
  panel.clearSelection();
  panel.handleInput("0"); // reset cursor to top (0)
  // Navigate to hunk 1 removed line (index 5)
  panel.handleInput("\x1b[B"); // hunk 1 header (index 2)
  panel.handleInput("\x1b[B"); // context line 1 (index 3)
  panel.handleInput("\x1b[B"); // context line 2 (index 4)
  panel.handleInput("\x1b[B"); // removed line (index 5)
  // Shift+Down to select through added line (index 6)
  panel.handleInput("\x1b[1;2B");
  const rangeContext = panel.formatSelectedContext();
  assert.ok(rangeContext);
  assert.ok(rangeContext.includes("-                const result = await legacyFetch"));
  assert.ok(rangeContext.includes("+                const result = await modernFetch"));
  assert.ok(!rangeContext.includes("isAuthorized"), "only range is selected");
});

test("terminal resize maintains column constraints in Mode B across 34, 45, 60, 80 cols", () => {
  const actions = makeActions();
  const panel = new DiffPanel(actions, { collapseFiles: false });
  panel.setView({
    key: "resize-test",
    title: "DIFF",
    notices: [],
    files: syntheticCompactedFiles,
  });
  panel.setCompactMode(true);

  for (const width of [34, 45, 60, 80, 100]) {
    const rendered = panel.render(width);
    for (const line of rendered) {
      assert.ok(visibleWidth(line) <= width, `line exceeds width ${width}: ${stripTerminalSequences(line)}`);
    }
  }
});

test("real git workspace modifications yield authentic diff hunks with correct compaction", async () => {
  const ws = await createModifiedWorkspace();
  try {
    await ws.writeModifiedFiles();
    const status = (await ws.git("status", "--porcelain")).toString();
    assert.ok(status.includes("M src/nested.ts"));
    assert.ok(status.includes("M pipeline.py"));
    assert.ok(status.includes("M deployment.yaml"));

    const diff = (await ws.git("diff")).toString();
    assert.ok(diff.includes("-                const result = await legacyFetch(query);"));
    assert.ok(diff.includes("+                const result = await modernFetch(query, { timeout: 5000 });"));
  } finally {
    await ws.close();
  }
});

test("hunk cut by row limit disables compaction to prevent misrepresenting truncated hunk", () => {
  const actions = makeActions();
  const panel = new DiffPanel(actions, { collapseFiles: false });

  // Build a file where the hunk has 2005 rows: rows 1..2000 have 12 spaces,
  // but row 2001 (truncated) has 0 spaces.
  const largeRows: DiffRow[] = [
    { kind: "hunk", text: "@@ -1,2005 +1,2005 @@" },
  ];
  for (let i = 1; i <= 2000; i++) {
    largeRows.push({ kind: "added", newLine: i, text: `            nested_line_${i}` });
  }
  for (let i = 2001; i <= 2005; i++) {
    largeRows.push({ kind: "added", newLine: i, text: `top_level_zero_indent_${i}` });
  }

  panel.setView({
    key: "truncated-hunk-test",
    title: "DIFF",
    notices: [],
    files: [{
      path: "truncated.ts",
      kind: "modified",
      added: 2005,
      removed: 0,
      getRows: () => largeRows,
    }],
  });
  panel.setCompactMode(true);

  // Because the hunk was cut mid-hunk at 2000 rows, compaction must be disabled
  // for this hunk rather than falsely stripping 12 spaces based on the prefix.
  const rendered = allLines(panel, 120);
  const sampleLine = rendered.find(l => l.includes("nested_line_1"));
  assert.ok(sampleLine, "line rendered");
  assert.ok(sampleLine.includes("            nested_line_1"), "retains original 12 spaces because hunk was cut");
});

class CompactionTestTerminal implements Terminal {
  columns = 120; rows = 24; kittyProtocolActive = false;
  start(): void {} stop(): void {} async drainInput(): Promise<void> {}
  write(): void {} moveBy(): void {} hideCursor(): void {} showCursor(): void {}
  clearLine(): void {} clearFromCursor(): void {} clearScreen(): void {}
  setTitle(): void {} setProgress(): void {} setProgramStatus(): void {}
}

test("/diff b opens directly in Mode B and /diff a switches to Mode A", async () => {
  const ws = await createModifiedWorkspace();
  try {
    const handlers = new Map<string, ((event: unknown, ctx: unknown) => unknown)[]>();
    const commands = new Map<string, { handler: (args: string, ctx: unknown) => Promise<void> }>();

    const pi = {
      on(name: string, fn: (event: unknown, ctx: unknown) => unknown) {
        handlers.set(name, [...(handlers.get(name) ?? []), fn]);
        return () => {};
      },
      registerCommand(name: string, cmd: { handler: (args: string, ctx: unknown) => Promise<void> }) {
        commands.set(name, cmd);
      },
      registerShortcut() {},
      getCommands: () => [],
      appendEntry() {},
    } as unknown;

    iterationDiff(pi as any);

    const tui = new TuiAltScreen(new CompactionTestTerminal());
    const editor: Component = { invalidate() {}, render: () => ["draft"] };
    const chat = new Container();
    tui.addChild(chat); tui.addChild(editor);
    const native = new VStack([new ScrollView(chat), new VStack([editor])]);
    tui.setLayoutRoot(native); tui.setFocus(editor);

    let widget: (Component & { dispose?: () => void }) | undefined;
    const ctx = {
      mode: "tui",
      cwd: ws.root,
      sessionManager: {
        getSessionId: () => "compaction-session-1",
        getBranch: () => [],
      },
      ui: {
        notify() {},
        getEditorText: () => "",
        setEditorText() {},
        theme: {
          bold: (t: string) => t,
          fg: (_role: string, t: string) => t,
          bg: (_role: string, t: string) => t,
        },
        setWidget(_id: string, factory: any) {
          if (widget?.dispose) widget.dispose();
          widget = factory ? factory(tui) : undefined;
        },
      },
    };

    // Trigger session_start to register commands
    for (const h of handlers.get("session_start") ?? []) {
      h({}, ctx);
    }

    const diffCmd = commands.get("diff");
    assert.ok(diffCmd, "/diff command registered");

    // Execute `/diff b` to open directly in Mode B
    await diffCmd.handler("b", ctx);
    assert.ok(widget, "widget mounted via /diff b");

    // Root is now ResizableDockRoot, panel is child 1
    const dockRoot = (tui as any).layoutRoot;
    assert.ok(dockRoot);
    const panel = dockRoot.entries[1].component as DiffPanel;
    assert.ok(panel, "panel child exists");
    assert.equal(panel.getCompactMode(), true, "opened directly in Mode B");

    // Execute `/diff a` when open to switch in-place to Mode A
    await diffCmd.handler("a", ctx);
    assert.equal(panel.getCompactMode(), false, "switched in-place to Mode A");

    // Execute `/diff b` when open to switch in-place back to Mode B
    await diffCmd.handler("b", ctx);
    assert.equal(panel.getCompactMode(), true, "switched in-place to Mode B");

    // Execute `/diff` to close
    await diffCmd.handler("", ctx);
    assert.equal(widget, undefined, "closed by empty /diff");
  } finally {
    await ws.close();
  }
});
