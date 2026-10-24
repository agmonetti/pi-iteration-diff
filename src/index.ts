import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { mountDock, type DockHandle } from "./ui/layout-adapter.js";
import { DiffPanel } from "./ui/diff-panel.js";
import { createIterationView } from "./diffs/iteration-diff.js";
import { registerCaptureLifecycle } from "./lifecycle/pi-lifecycle.js";
import { workspaceRoot } from "./snapshots/capture.js";
import { DEFAULT_SETTINGS, SETTINGS_ENTRY, restoreSettings, showDiffSettings } from "./ui/diff-settings.js";

/** Silent capture; the native conversation/editor are never replaced. */
export default function iterationDiff(pi: ExtensionAPI): void {
  const capture = registerCaptureLifecycle(pi);
  let dock: DockHandle | undefined;
  let panel: DiffPanel | undefined;
  let settings = { ...DEFAULT_SETTINGS };
  let owner: ExtensionContext | undefined;
  let closedWindow: string | undefined;
  let attemptedWindow: string | undefined;
  let settingsGeneration = 0;
  const windowKey = (): string | undefined => {
    const state = capture.state;
    const id = state.state === "capturing" ? state.id : state.window?.id;
    return id ? JSON.stringify(id) : undefined;
  };
  const persist = (ctx = owner): void => {
    try { pi.appendEntry(SETTINGS_ENTRY, { version: 1, ...settings }); }
    catch { ctx?.ui.notify("Diff settings could not be saved; changes apply only in memory", "warning"); }
  };
  const rememberWidth = (): void => {
    if (!dock || !settings.rememberWidth) return;
    const width = dock.getDockRatio() * 100;
    if (width === settings.dockWidth) return;
    settings = { ...settings, dockWidth: width };
    persist();
  };
  let shownState: typeof capture.state | undefined;
  let generation = 0;
  const close = (): void => {
    generation++;
    dock?.close(); dock = undefined;
    panel = undefined;
    shownState = undefined;
  };
  const dismiss = (): void => {
    close();
    owner?.ui.setWidget("iteration-diff", undefined);
    owner = undefined;
  };
  const manualDismiss = (): void => {
    closedWindow = windowKey();
    rememberWidth();
    dismiss();
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
  pi.on("agent_settled", async (_event, ctx) => {
    refresh();
    const key = windowKey();
    if (!settings.autoOpen || dock || !key || key === closedWindow || key === attemptedWindow ||
        capture.state.state !== "individual" || capture.state.window.status !== "complete" ||
        capture.state.window.attribution !== "individual") return;
    attemptedWindow = key;
    await open(ctx, true);
  });
  pi.on("session_shutdown", () => { settingsGeneration++; dismiss(); });

  const open = async (ctx: ExtensionContext, automatic = false): Promise<void> => {
      if (dock) return;
      if (ctx.mode !== "tui") {
        ctx.ui.notify("Diff requires Pi TUI fullscreen", "warning"); return;
      }
      const version = ++generation;
      const preferencesVersion = settingsGeneration;
      const sessionId = ctx.sessionManager.getSessionId();
      const cwd = ctx.cwd;
      const state = capture.state;
      const key = windowKey();
      const stale = (): boolean => version !== generation || ctx.cwd !== cwd ||
        ctx.sessionManager.getSessionId() !== sessionId || capture.state !== state ||
        (automatic && (!settings.autoOpen || preferencesVersion !== settingsGeneration || key === closedWindow));
      const id = state.state === "capturing" ? state.id : state.window?.id;
      if (id) {
        try {
          const root = await workspaceRoot(ctx.cwd);
          if (stale()) return;
          if (id.sessionId !== sessionId || id.root !== root) {
            if (automatic) return;
            capture.invalidate("session-or-workspace-changed");
          }
        } catch {
          if (stale()) return;
          if (automatic) return;
          capture.invalidate("workspace-unavailable");
        }
      }
      owner = ctx;
      try {
        ctx.ui.setWidget("iteration-diff", (tui) => {
          panel = new DiffPanel({
            render: () => tui.requestRender(),
            editor: () => dock?.focusEditor(),
            close: manualDismiss,
            resize: (delta) => { dock?.resizeBy(delta); rememberWidth(); },
            setDockWidth: (cols) => dock?.setDockWidth(cols),
            resizeEnd: rememberWidth,
            appendContext: (snippet) => {
              if (!owner) return;
              const prev = owner.ui.getEditorText();
              const next = prev ? `${prev}\n\n${snippet}` : snippet;
              owner.ui.setEditorText(next);
            },
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
              if (role === "selectedBg") {
                try {
                  const styled = ctx.ui.theme.bg("selectedBg", text);
                  if (styled && styled !== text) return styled;
                } catch { /* Unsupported theme token: use reverse video below. */ }
                return `\x1b[7m${text}\x1b[27m`;
              }
              if (role === "selected") return `\x1b[7m${text}\x1b[27m`;
              return text;
            },
          }, settings);
          refresh();
          dock = mountDock(tui, panel, settings.dockWidth / 100);
          return { dispose: close, invalidate() {}, render(width) {
            // Polling by identity also covers state changes while a prior render was queued.
            refresh();
            return tui.terminal.columns < 90
              ? [truncateToWidth("Diff hidden: expand to 90 columns; /diff closes", width)] : [];
          } };
        });
      } catch (error) {
        dismiss();
        ctx.ui.notify(error instanceof Error ? error.message : "Failed to open diff", "warning");
      }
  };
  const command = {
    description: "Toggle the last observed iteration diff (F6 opens/focuses files)",
    handler: async (_args: string, ctx: ExtensionContext): Promise<void> => {
      if (dock) manualDismiss();
      else await open(ctx);
    },
  };
  pi.registerShortcut("f6", { description: "Open or focus diff", handler: async ctx => {
    if (!dock) await open(ctx);
    dock?.focusPanel();
  } });
  pi.registerCommand("diff-settings", {
    description: "Configure diff presentation and opt-in automatic opening",
    handler: async (_args, ctx) => {
      const version = settingsGeneration;
      await showDiffSettings(ctx, settings, next => {
        if (version !== settingsGeneration) return;
        generation++;
        settings = next;
        panel?.setPreferences(settings);
        dock?.setDockRatio(settings.dockWidth / 100);
        persist(ctx);
      });
    },
  });
  const restore = (ctx: ExtensionContext): void => {
    settingsGeneration++;
    dismiss();
    settings = restoreSettings(ctx.sessionManager.getBranch());
    closedWindow = undefined;
    attemptedWindow = undefined;
  };
  pi.on("session_tree", (_event, ctx) => {
    capture.invalidate("session-tree-changed");
    restore(ctx);
  });
  // getCommands is public but unavailable during extension loading. Resolve only
  // after all extensions loaded; never register over a foreign /diff.
  let registeredDiff = false;
  pi.on("session_start", (_event, ctx) => {
    restore(ctx);
    if (registeredDiff) return;
    if (pi.getCommands().some(entry => entry.name === "diff" || entry.name.startsWith("diff:"))) {
      ctx.ui.notify("/diff is occupied; use F6 to open the diff dock", "info");
    } else {
      pi.registerCommand("diff", command);
      registeredDiff = true;
    }
  });
}
