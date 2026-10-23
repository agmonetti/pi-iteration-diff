import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { mountDock, type DockHandle } from "./ui/layout-adapter.js";
import { appendExcerpt, FeasibilityPanel } from "./ui/feasibility-panel.js";
import { registerCaptureLifecycle } from "./lifecycle/pi-lifecycle.js";

/** M0 UI remains synthetic; M1 captures silently without persistence or model messages. */
export default function feasibilitySpike(pi: ExtensionAPI): void {
  registerCaptureLifecycle(pi);
  let dock: DockHandle | undefined;
  let unsubscribe: (() => void) | undefined;
  const close = (): void => {
    dock?.close(); dock = undefined;
    unsubscribe?.(); unsubscribe = undefined;
  };
  const events: string[] = [];
  const record = (name: string): void => {
    events.push(name);
    if (events.length > 100) events.shift();
  };
  pi.on("input", (event) => { record(`input:${event.source}`); });
  pi.on("before_agent_start", (event) => { record(`before_agent_start:${event.messageType}`); });
  pi.on("agent_start", () => { record("agent_start"); });
  pi.on("turn_start", () => { record("turn_start"); });
  pi.on("turn_end", () => { record("turn_end"); });
  pi.on("agent_end", () => { record("agent_end"); });
  pi.on("agent_before_settle", () => { record("agent_before_settle"); });
  pi.on("tool_execution_start", (event) => { record(`tool_execution_start:${event.toolName}`); });
  pi.on("tool_execution_end", (event) => { record(`tool_execution_end:${event.toolName}`); });
  pi.on("agent_settled", (event) => { record(`agent_settled:aborted=${event.aborted}`); });
  pi.on("session_start", () => { events.length = 0; record("session_start"); });
  pi.on("session_shutdown", (_event, ctx) => {
    dock?.close(); dock = undefined;
    unsubscribe?.(); unsubscribe = undefined;
    ctx.ui.setWidget("iteration-diff-m0", undefined);
    events.length = 0;
  });
  pi.registerCommand("m0-events", {
    description: "M0: show last 100 lifecycle names (no prompt contents)",
    handler: async (_args, ctx) => { ctx.ui.notify(events.join(" → ") || "No events", "info"); },
  });
  pi.registerCommand("m0-diff", {
    description: "M0: toggle SYNTHETIC sidebar; F6 selects panel",
    handler: async (_args, ctx) => {
      if (dock) {
        dock.close(); dock = undefined;
        unsubscribe?.(); unsubscribe = undefined;
        ctx.ui.setWidget("iteration-diff-m0", undefined);
        return;
      }
      if (ctx.mode !== "tui") {
        ctx.ui.notify("M0 requiere TUI fullscreen", "warning"); return;
      }
      try {
        ctx.ui.setWidget("iteration-diff-m0", (tui) => {
          const panel = new FeasibilityPanel({
            render: () => tui.requestRender(),
            append: (start, end) => ctx.ui.setEditorText(appendExcerpt(ctx.ui.getEditorText(), start, end)),
            editor: () => dock?.focusEditor(),
            highlight: (text) => ctx.ui.theme.fg("accent", text),
          });
          dock = mountDock(tui, panel);
          unsubscribe = ctx.ui.onTerminalInput((data) => {
            if (!matchesKey(data, "f6")) return;
            dock?.focusPanel(); return { consume: true };
          });
          return { dispose: close, invalidate() {}, render(width) {
            return tui.terminal.columns < 90
              ? [truncateToWidth("M0: panel oculto; ampliá a 90 columnas o cerrá /m0-diff", width)] : [];
          } };
        });
      } catch (error) {
        close();
        ctx.ui.setWidget("iteration-diff-m0", undefined);
        ctx.ui.notify(error instanceof Error ? error.message : "M0 layout error", "warning");
      }
    },
  });
}
