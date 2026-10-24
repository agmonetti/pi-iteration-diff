import {
  HStack, ScrollView, VStack, TuiAltScreen, isViewportTUI,
  type Component, type StackChild, type TUI, type TuiMouseEvent,
} from "@earendil-works/pi-tui";

// Pi 1.4.0: layoutRoot and getFocusedComponent are not part of the public TUI interface.
interface InspectedTUI {
  layoutRoot?: Component;
  getFocusedComponent(): Component | null;
}

export interface DockHandle {
  focusPanel(): void;
  focusEditor(): void;
  close(): void;
  resizeBy(deltaCols: number): void;
  setDockWidth(cols: number): void;
  getDockWidth(): number;
  getDockRatio(): number;
  setDockRatio(ratio: number): void;
}

export class ResizableDockRoot extends HStack {
  private ratio: number;
  private lastTerminalWidth?: number;

  constructor(children: StackChild[], initialRatio = 0.45, private readonly focusNative?: () => void) {
    super(children);
    this.ratio = 0.45;
    this.dockRatio = initialRatio;
  }

  override handleMouse(event: TuiMouseEvent): undefined {
    if (event.type === "press" && event.button === "left" && event.width >= 90 &&
        event.x >= 0 && event.x < event.width - this.getDockWidth(event.width)) {
      this.focusNative?.();
    }
    // Observe only: a dispatch result would capture the press and clear native text selection.
    return undefined;
  }

  get dockRatio(): number { return this.ratio; }
  set dockRatio(value: number) {
    if (Number.isFinite(value)) {
      this.ratio = Math.max(0.3, Math.min(0.6, value));
      if (this.lastTerminalWidth !== undefined) {
        this.updateDockBasis(this.lastTerminalWidth);
      }
    }
  }
  getDockWidth(width: number): number {
    return Math.max(34, Math.min(Math.max(34, width - 46), Math.round(width * this.ratio)));
  }

  updateDockBasis(totalWidth: number): void {
    this.lastTerminalWidth = totalWidth;
    if (this.entries[1]) {
      this.entries[1].basis = this.getDockWidth(totalWidth);
    }
  }

  resizeBy(deltaCols: number, totalWidth: number): void {
    const currentCols = this.getDockWidth(totalWidth);
    const newCols = Math.max(34, Math.min(totalWidth - 46, currentCols + deltaCols));
    this.dockRatio = newCols / Math.max(1, totalWidth);
    this.updateDockBasis(totalWidth);
  }
  setDockWidth(cols: number, totalWidth: number): void {
    const clamped = Math.max(34, Math.min(totalWidth - 46, cols));
    this.dockRatio = clamped / Math.max(1, totalWidth);
    this.updateDockBasis(totalWidth);
  }
  override render(width: number): string[] {
    this.updateDockBasis(width);
    return super.render(width);
  }
}

export function mountDock(tui: TUI, panel: Component, initialRatio = 0.45): DockHandle {
  if (!isViewportTUI(tui) || !("layoutRoot" in tui) ||
      !("getFocusedComponent" in tui) || typeof tui.getFocusedComponent !== "function") {
    throw new Error("El diff requiere Pi fullscreen con layout compatible (probado en 1.4.0)");
  }
  const internal = tui as TUI & InspectedTUI;
  const native = internal.layoutRoot;
  // Match createChatViewport by identity, not only class: never wrap an unknown owner's root.
  if (!(native instanceof VStack) || native.children.length !== 2 ||
      !(native.children[0] instanceof ScrollView) ||
      native.children[0].children[0] !== tui.children[0] ||
      !(native.children[1] instanceof VStack) ||
      native.children[1].children.length !== tui.children.length - 1 ||
      !native.children[1].children.every((child, i) => child === tui.children[i + 1])) {
    throw new Error("Layout desconocido u ocupado; el diff no reemplazó el root");
  }
  const previousFocus = internal.getFocusedComponent();
  const root = new ResizableDockRoot([
    { component: native, basis: 0, grow: 1, shrink: 1, minSize: 46 },
    { component: panel, basis: Math.max(34, Math.min(tui.terminal.columns - 46, Math.round(tui.terminal.columns * initialRatio))), minSize: 34, grow: 0, shrink: 1,
      visible: ({ width }: { width: number }) => {
        if (width < 90 && internal.getFocusedComponent() === panel) tui.setFocus(previousFocus);
        return width >= 90;
      } },
  ], initialRatio, () => {
    if (ownsRoot()) tui.setFocus(previousFocus);
  });
  root.updateDockBasis(tui.terminal.columns);
  tui.setLayoutRoot(root);
  // Pi 1.4.0 consumes page/line shortcuts before extension input listeners.
  // Route the public fullscreen scroll method by focus, leaving mouse routing
  // (which targets ScrollView directly) and the native transcript unchanged.
  const viewport = tui instanceof TuiAltScreen ? tui : undefined;
  const originalScroll = viewport?.scrollBy;
  const scrollPanel = panel as Component & { scrollBy?: (lines: number) => void };
  const routedScroll = (lines: number): void => {
    if (ownsRoot() && internal.getFocusedComponent() === panel && scrollPanel.scrollBy) {
      scrollPanel.scrollBy(lines);
    } else {
      originalScroll?.call(viewport, lines);
    }
  };
  let closed = false;
  const ownsRoot = (): boolean => !closed && internal.layoutRoot === root;
  if (viewport && scrollPanel.scrollBy) viewport.scrollBy = routedScroll;
  return {
    focusPanel() { if (ownsRoot() && tui.terminal.columns >= 90) tui.setFocus(panel); },
    focusEditor() { if (ownsRoot()) tui.setFocus(previousFocus); },
    resizeBy(deltaCols: number) {
      if (!ownsRoot()) return;
      root.resizeBy(deltaCols, tui.terminal.columns);
      root.updateDockBasis(tui.terminal.columns);
      root.invalidate();
      tui.requestRender();
    },
    setDockWidth(cols: number) {
      if (!ownsRoot()) return;
      root.setDockWidth(cols, tui.terminal.columns);
      root.updateDockBasis(tui.terminal.columns);
      root.invalidate();
      tui.requestRender();
    },
    getDockRatio() { return root.dockRatio; },
    setDockRatio(ratio) {
      if (!ownsRoot()) return;
      root.dockRatio = ratio;
      root.updateDockBasis(tui.terminal.columns);
      root.invalidate();
      tui.requestRender();
    },
    getDockWidth() {
      return root.getDockWidth(tui.terminal.columns);
    },
    close() {
      if (viewport?.scrollBy === routedScroll && originalScroll) viewport.scrollBy = originalScroll;
      if (ownsRoot()) {
        tui.setLayoutRoot(native);
        tui.setFocus(previousFocus);
        tui.requestRender(true);
      }
      closed = true;
    },
  };
}
