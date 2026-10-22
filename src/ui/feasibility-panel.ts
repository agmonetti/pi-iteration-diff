import { matchesKey, truncateToWidth, type Component, type TuiMouseEvent,
  type TuiMouseEventResult } from "@earendil-works/pi-tui";

const lines = ["const café = '🙂 e\u0301';", "\treturn café;", "// synthetic M0 fixture"];

export function appendExcerpt(draft: string, start: number, end: number): string {
  return `${draft}${draft ? "\n\n" : ""}[M0 synthetic fixture.txt | new | ${start + 1}-${end + 1} | DISCUSS]\n${lines.slice(start, end + 1).join("\n")}`;
}

/** Synthetic probe only: not a diff parser or a product review model. */
export class FeasibilityPanel implements Component {
  anchor = 0;
  cursor = 0;
  private dragging = false;
  lastDrop = "not attempted";
  constructor(private readonly actions: {
    render(): void;
    append(start: number, end: number): void;
    editor(): void;
  }) {}
  invalidate(): void {}
  render(width: number): string[] {
    const [start, end] = this.range();
    return ["│ M0 SYNTHETIC (not workspace)",
      "│ ↑/↓ move; Shift+↓ range",
      "│ a append; Esc editor",
      ...lines.map((line, i) => `│ ${i >= start && i <= end ? ">" : " "} ${i + 1} ${line.replaceAll("\t", "    ")}`),
      `│ Cross-pane release: ${this.lastDrop}`,
    ].map((line) => truncateToWidth(line, width));
  }
  range(): [number, number] {
    return [Math.min(this.anchor, this.cursor), Math.max(this.anchor, this.cursor)];
  }
  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "tab")) {
      this.actions.editor();
    } else if (data === "a") {
      this.actions.append(...this.range());
    } else {
      const down = matchesKey(data, "down") || matchesKey(data, "shift+down");
      const up = matchesKey(data, "up") || matchesKey(data, "shift+up");
      if (!down && !up) return;
      this.cursor = Math.max(0, Math.min(lines.length - 1, this.cursor + (down ? 1 : -1)));
      if (!matchesKey(data, "shift+down") && !matchesKey(data, "shift+up")) this.anchor = this.cursor;
    }
    this.actions.render();
  }
  handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
    const row = Math.max(0, Math.min(lines.length - 1, event.y - 3));
    if (event.type === "press" && event.button === "left" && event.y >= 3 && event.y < 6) {
      this.anchor = this.cursor = row;
      this.dragging = true;
      return { capture: true, focus: true };
    }
    if (!this.dragging) return;
    if (event.type === "drag") {
      this.cursor = row;
      return { handled: true };
    }
    if (event.type === "release") {
      this.dragging = false;
      // shortcut: record cross-pane delivery only; editor hit-testing belongs to M3.
      this.lastDrop = event.x < 0 ? "received outside panel" : "inside panel";
      return { handled: true, render: true };
    }
    return { handled: true };
  }
}
