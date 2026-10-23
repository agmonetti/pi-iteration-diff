import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { mountDock, type DockHandle } from "./ui/layout-adapter.js";
import { DiffPanel } from "./ui/diff-panel.js";
import { createIterationView } from "./diffs/iteration-diff.js";
import { registerCaptureLifecycle } from "./lifecycle/pi-lifecycle.js";
import { workspaceRoot } from "./snapshots/capture.js";

/** Silent capture; the native conversation/editor are never replaced. */
export default function iterationDiff(pi: ExtensionAPI): void {
  const capture = registerCaptureLifecycle(pi);
  let dock: DockHandle | undefined;
  let panel: DiffPanel | undefined;
  let unsubscribe: (() => void) | undefined;
  let owner: ExtensionCommandContext | undefined;
  let shownState: typeof capture.state | undefined;
  let generation = 0;
  const close = (): void => {
    generation++;
    dock?.close(); dock = undefined;
    unsubscribe?.(); unsubscribe = undefined;
    panel = undefined;
    shownState = undefined;
  };
  const dismiss = (): void => {
    close();
    owner?.ui.setWidget("iteration-diff", undefined);
    owner = undefined;
  };
  const refresh = (): void => {
    if (!panel || shownState === capture.state) return;
    shownState = capture.state;
    panel.setView(createIterationView(shownState));
  };
  // Registered after the capture handlers: asynchronous capture finishes first.
  pi.on("input", refresh);
  pi.on("before_agent_start", refresh);
  pi.on("message_start", refresh);
  pi.on("agent_settled", refresh);
  pi.on("session_shutdown", dismiss);

  const command = {
    description: "Toggle the last observed iteration diff (F6 focuses files)",
    handler: async (_args: string, ctx: ExtensionCommandContext): Promise<void> => {
      if (dock) { dismiss(); return; }
      if (ctx.mode !== "tui") {
        ctx.ui.notify("El diff requiere Pi TUI fullscreen", "warning"); return;
      }
      const version = ++generation;
      const state = capture.state;
      const id = state.state === "capturing" ? state.id : state.window?.id;
      if (id) {
        try {
          const root = await workspaceRoot(ctx.cwd);
          if (version !== generation) return;
          if (id.sessionId !== ctx.sessionManager.getSessionId() || id.root !== root) {
            capture.invalidate("session-or-workspace-changed");
          }
        } catch {
          if (version !== generation) return;
          capture.invalidate("workspace-unavailable");
        }
      }
      owner = ctx;
      try {
        ctx.ui.setWidget("iteration-diff", (tui) => {
          panel = new DiffPanel({
            render: () => tui.requestRender(),
            editor: () => dock?.focusEditor(),
            close: dismiss,
            style: (role, text) => {
              if (role === "bold") return ctx.ui.theme.bold(text);
              if (role === "dim") return ctx.ui.theme.fg("dim", text);
              if (role === "border") return ctx.ui.theme.fg("border", text);
              if (role === "accent") return ctx.ui.theme.fg("accent", text);
              if (role === "muted") return ctx.ui.theme.fg("muted", text);
              if (role === "warning") return ctx.ui.theme.fg("warning", text);
              if (role === "text") return ctx.ui.theme.fg("text", text);
              if (role === "added") return ctx.ui.theme.fg("toolDiffAdded", text);
              if (role === "removed") return ctx.ui.theme.fg("toolDiffRemoved", text);
              return ctx.ui.theme.fg(role as any, text);
            },
          });
          refresh();
          dock = mountDock(tui, panel);
          unsubscribe = ctx.ui.onTerminalInput((data) => {
            if (!matchesKey(data, "f6")) return;
            dock?.focusPanel(); return { consume: true };
          });
          return { dispose: close, invalidate() {}, render(width) {
            // Polling by identity also covers state changes while a prior render was queued.
            refresh();
            return tui.terminal.columns < 90
              ? [truncateToWidth("Diff oculto: ampliá a 90 columnas; /iteration-diff cierra", width)] : [];
          } };
        });
      } catch (error) {
        dismiss();
        ctx.ui.notify(error instanceof Error ? error.message : "No se pudo abrir el diff", "warning");
      }
    },
  };
  pi.registerCommand("iteration-diff", command);
  // getCommands is public but unavailable during extension loading. Resolve only
  // after all extensions loaded; never register over a foreign /diff.
  let registeredDiff = false;
  pi.on("session_start", (_event, ctx) => {
    dismiss();
    if (registeredDiff) return;
    if (pi.getCommands().some(entry => entry.name === "diff" || entry.name.startsWith("diff:"))) {
      ctx.ui.notify("/diff está ocupado; usá /iteration-diff", "info");
    } else {
      pi.registerCommand("diff", command);
      registeredDiff = true;
    }
  });
}
