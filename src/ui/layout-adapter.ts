import {
  HStack, ScrollView, VStack, TuiAltScreen, isViewportTUI,
  type Component, type TUI,
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
}

export function mountDock(tui: TUI, panel: Component): DockHandle {
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
  const root = new HStack([
    { component: native, basis: 0, grow: 1, shrink: 1, minSize: 1 },
    { component: panel, basis: 34, grow: 0, shrink: 0,
      visible: ({ width }) => {
        if (width < 90 && internal.getFocusedComponent() === panel) tui.setFocus(previousFocus);
        return width >= 90;
      } },
  ]);
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
