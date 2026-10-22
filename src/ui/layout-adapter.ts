import {
  HStack, ScrollView, VStack, isViewportTUI,
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
    throw new Error("M0 requiere Pi fullscreen con layout compatible (probado en 1.4.0)");
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
    throw new Error("Layout desconocido u ocupado; M0 no reemplazó el root");
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
  let closed = false;
  const ownsRoot = (): boolean => !closed && internal.layoutRoot === root;
  return {
    focusPanel() { if (ownsRoot() && tui.terminal.columns >= 90) tui.setFocus(panel); },
    focusEditor() { if (ownsRoot()) tui.setFocus(previousFocus); },
    close() {
      if (ownsRoot()) {
        tui.setLayoutRoot(native);
        tui.setFocus(previousFocus);
        tui.requestRender(true);
      }
      closed = true;
    },
  };
}
