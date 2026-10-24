import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { DiffFile, DiffRow, IterationView } from "../../src/diffs/iteration-diff.js";
import { DiffPanel, type Actions } from "../../src/ui/diff-panel.js";
import { mountDock, type DockHandle } from "../../src/ui/layout-adapter.js";

// Synthetic data only. Never loaded by the product extension.
const samples = [
  { path: "nested.ts", blocks: [
    ["            if (authorized) {", "              const result = await service.process(record, options, context);", "", "              return result;", "            }"],
    ["    function otherLevel() {", "      return anotherService.withLongName().resolve(configuration);", "    }"],
  ] },
  { path: "pipeline.py", blocks: [
    ["        if dataset:", "            for item in dataset:", "                yield await engine.process_item(item, dry_run=False)", "        ", "            return"],
    ["def top_level():", "    return build_pipeline(configuration, dependencies, environment)"],
  ] },
  { path: "deployment.yaml", blocks: [
    ["    spec:", "      containers:", "        - name: worker", "          resources:", "            limits:", "              memory: 4Gi", ""],
    ["  metadata:", "    annotations:", "      description: a deliberately long annotation for horizontal review"],
  ] },
];

/** Lab-only B view: render shorter text; serialize context from the original rows. */
export class IndentationLabPanel extends DiffPanel {
  private readonly display = { compact: false };

  constructor(actions: Actions, compact: boolean) {
    super(actions, { collapseFiles: false });
    this.display.compact = compact;
    const files: DiffFile[] = samples.map(sample => {
      const rows: DiffRow[] = [];
      let line = 40;
      for (const block of sample.blocks) {
        const nonblank = block.filter(text => text.trim());
        const indent = Math.min(...nonblank.map(text => /^ */.exec(text)![0].length));
        rows.push({ kind: "hunk", text: `@@ -${line},${block.length} +${line},${block.length} @@` });
        block.forEach((text, index) => {
          const original = index === 1 ? text.replace(/service|engine|containers/, "legacy") : text;
          const displayText = (value: string): string => this.display.compact ? value.slice(Math.min(indent, /^ */.exec(value)![0].length)) : value;
          if (index === 1) rows.push({ kind: "removed", oldLine: line, get text() { return displayText(original); } });
          rows.push({ kind: index === 1 ? "added" : "context", oldLine: index === 1 ? undefined : line,
            newLine: line, get text() { return displayText(text); } });
          line++;
        });
        line += 20;
      }
      return { path: sample.path, kind: "modified", added: 2, removed: 2, getRows: () => rows };
    });
    const view: IterationView = { key: `indent-lab-${compact}`, title: `DIFF: LAB ${compact ? "B compact" : "A original"}`, notices: [], files };
    this.setView(view);
  }

  override formatSelectedContext(): string | undefined {
    const compact = this.display.compact;
    this.display.compact = false;
    try { return super.formatSelectedContext(); }
    finally { this.display.compact = compact; }
  }
}

export default function indentationLab(pi: ExtensionAPI): void {
  let dock: DockHandle | undefined;
  const close = (): void => { dock?.close(); dock = undefined; };
  pi.on("session_shutdown", close);
  pi.registerCommand("lab-diff", {
    description: "Synthetic M4.1 comparison: /lab-diff a|b|close (not product)",
    async handler(args, ctx) {
      close();
      ctx.ui.setWidget("indentation-lab", undefined);
      if (args.trim() === "close") return;
      if (ctx.mode !== "tui") return;
      try {
        ctx.ui.setWidget("indentation-lab", tui => {
          const panel = new IndentationLabPanel({
            render: () => tui.requestRender(), editor: () => dock?.focusEditor(), close,
            resize: delta => dock?.resizeBy(delta), setDockWidth: cols => dock?.setDockWidth(cols),
            appendContext: text => {
              const draft = ctx.ui.getEditorText();
              ctx.ui.setEditorText(draft ? `${draft}\n\n${text}` : text);
            },
            style: (role, text) => {
              if (role === "bold") return ctx.ui.theme.bold(text);
              if (role === "selectedBg" || role === "selected") return `\x1b[7m${text}\x1b[27m`;
              return ctx.ui.theme.fg(role === "added" ? "toolDiffAdded" : role === "removed" ? "toolDiffRemoved" : role, text);
            },
          }, args.trim().toLowerCase() === "b");
          dock = mountDock(tui, panel);
          dock.focusPanel();
          return { dispose: close, invalidate() {}, render: () => [] };
        });
      } catch (error) {
        close();
        ctx.ui.notify(String(error), "warning");
      }
    },
  });
}
