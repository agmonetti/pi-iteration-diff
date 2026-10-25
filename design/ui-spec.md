# UI Specification: pi-iteration-diff

**Version:** 2.0 — Definitive specification approved by the user
**Execution Environment:** Pi Coding Agent (Fullscreen interactive terminal and inside Herdr).
**Interface Type:** Terminal User Interface (TUI) mounted as an extension over `@earendil-works/pi-tui`.

---

## 1. Definitive Design Principles

1. **Non-intrusive extension over Pi:** The right panel mounts dynamically while preserving Pi's conversation transcript and native editor intact on the left. By default it opens/closes via `/diff`; F6 opens/focuses. M3.5 allows auto-open only by explicit opt-in after a complete individual iteration, without stealing focus; removes `/iteration-diff`.
2. **Strict consumption of the active theme:** No custom theme is introduced or required. All colors, styles, and contrasts are resolved dynamically from `ctx.ui.theme` according to the user's configuration in Pi (`system`, `dark`, `light`, or custom theme).
3. **Visual priority of selection:** When a line (added, deleted, or context) is part of a selected range, the selection style (`selectedBg` or video inversion) has **absolute visual priority** over addition and deletion backgrounds, precisely certifying which lines are marked.
4. **Minimalism and terminal sobriety:** Avoid unnecessary graphical ornaments, heavy badges, or fictitious tabs (no `Current` or `History` while those modes do not exist).
5. **Pure context transfer without auto-sending:** The sole primary action is appending the selected snippet (`a`) to Pi's native editor draft. No `FIX`, `DISCUSS`, or prefabricated prompts are introduced. Automatic sending is never triggered, and the existing draft is fully preserved.
6. **Automatic focus return:** Upon pressing `a`, context is appended and focus automatically returns to Pi's native editor to continue drafting freely. The panel remains open and retains its expansions.

---

## 2. Layout and Interactive Resizing Parameters

The right-side dock uses an initial target width of **45%** of the terminal and preserves a minimum functional width for the native chat and editor.

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│  PI TRANSCRIPT / CONVERSATION                              │  DIFF DOCK (45% terminal width)                         │
│                                                            │                                                         │
│  User: Refactor rate calculation                           │  │ DIFF · Last iteration                        2 files │
│  Agent: I applied normalization in calculator.ts...        │  │ +12 / -4                                             │
│                                                            │  │                                                      │
│                                                            │  │ ▾ calculator.ts M +3 / -2                   │
│                                                            │  │     src/utils/calculator.ts                          │
│                                                            │  │   11   11   const offset = init();                   │
│                                                            │  │   12   12 - const max = balance;                     │
│                                                            │  │   12   12 + const max = clamp(limit);                │
│                                                            │  │                                                      │
├────────────────────────────────────────────────────────────┤  │ ▸ rate.ts A +9 / -0                          │
│  PI NATIVE EDITOR                                          │  │     src/core/rate.ts                                 │
│  > Review exceptions as well|                              │  │                                                      │
│                                                            │  │ Enter: expand · a: append · ↑↓: navigate · Esc: edit │
└────────────────────────────────────────────────────────────┴──┴──────────────────────────────────────────────────────┘
```

### Layout Parameter Table

| Parameter | Default Value | Behavior |
|---|---|---|
| `MIN_COLUMNS_THRESHOLD` | `90 cols` | If total width is smaller, the dock hides automatically and focus returns to the native editor to safeguard chat readability. |
| `DOCK_INITIAL_RATIO` | `0.45` (45%) | Initial terminal width proportion assigned to the dock. |
| `CHAT_MIN_WIDTH` | `46 cols` | Guaranteed minimum width for Pi's transcript and editor. |
| `DOCK_MIN_WIDTH` | `34 cols` | Minimum diff panel width when shrinking. |
| `DOCK_MAX_WIDTH` | `60% terminal` | Configurable ratio between 30% and 60%; conversation/dock minimums prevail in small terminal. |

### Resizing
- **Mouse drag:** Dragging the vertical separator `│` dynamically adjusts dock width.
- **Keyboard:** Shortcuts `[` / `]` or `Ctrl+Left` / `Ctrl+Right` allow expanding or collapsing the dock in steps of 4 columns.
- **State persistence:** Adjusted width adapts to resize; Remember dock width On saves it per session branch. Off keeps transient adjustment until close. All six preferences and their scope are specified in `../docs/milestones/M3.5.md`.

---

## 3. Inline File Explorer (Two Lines per Header)

- **Inline with diffs:** Each file presents its unified content directly below its header without a separate viewer.
- **Initial collapse:** All collapsed by default; `/diff-settings` allows expanding when loading a new iteration without resetting current expansions.
- **Independent expansions:** `Enter` or click on the header toggles solely that file. Multiple files can remain open at once.
- **Two-line header:**
  - **Line 1 (Main):** Expansion indicator (`▾`/`▸`), compact status (`A`, `M`, `D`) before highlighted name (`bold`), and statistics (`+3 / -2`). Statuses describe observed delta only; do not query Git staging or renames.
  - **Secondary Line (Secondary):** Dimmed/`muted` relative path, discretely indented (`    src/path/to/file.ts`).
- **Full path inspection:** Path is never lost; under reduced widths it is truncated with `truncatePath` and inspection mode `i` or the bottom bar allow viewing the full path without cuts.
- **Visual differentiation:** Distinguishes active file (cursor `>`), expanded file (`▾`), and panel focus state (`accent`).

---

## 4. Hunks and Code Lines (Unified Diff)

- **Single row per line:** A single visual line per diff line; no auto-wrapping (no wrap).
- **Compact contextual gutter (M4.1):** One column for all files: `oldLine` in deletions, `newLine` in additions and context. Minimum width of four digits, expandable per file; `Line numbers: Off` hides it. The model and appended old/new ranges remain complete. Usual overhead 10 columns vs 15 of old dual: 5 recovered in modified, no new gain in created/deleted. Original indentation preserved.
- **Fixed gutter during horizontal scroll:** With focus on explorer, `←`/`→` or `h`/`l` scroll eight columns of code of the active expanded file, also from its header. Border, cursor, number, and sign remain fixed. `«` indicates hidden content to the left and `»` to the right (reserves one cell only on overflow). Independent offset per file, bounded to shown content; preserved when collapsing, adjusted when resizing viewport, and reset when iteration identity changes. `0`/`Home` resets active offset and preserves existing jump at start of explorer. Wheel remains vertical: Pi 1.4.0 exposes no reliable horizontal axis. Human protocol and isolated indentation experiment in `../docs/milestones/M4.1.md`.
- **Pi Theme semantic colors:** Additions (`toolDiffAdded`), deletions (`toolDiffRemoved`), context (`text`), gutter (`dim`), border (`border`), focus (`accent`).
- **Discrete Hunk headers:** Format `@@ -12,3 +12,4 @@` in muted/`dim` tone.
- **Full Hunk selection:** Positioning on the hunk header allows selecting it wholly for transfer.

---

## 5. Compact and Responsive Header and Footer (English-only)

### Two-Line Header (`basis: 2`)
- The dock adds a real top row outside scroll: `🭽` + `▔` up to visible width, in accent when focused and dim when unfocused. Sides and prefixes use `▏`; content/mouse area starts below top border. No SGR overline used.
- **Line 1 (Title and scope):** `│ DIFF · <Scope>` on the left and file count aligned to the right (`N files` or `1 file`).
  - **Contextual scopes (ADR-003):**
    - `Last iteration`: Normal complete individual iteration.
    - `Batch Net`: Batched window with multiple entries.
    - `Unverified`: Window without verified attribution.
    - `Partial`: Incomplete or partial capture.
    - `Cancelled`: Interrupted or cancelled execution.
    - `Failed`: Failed execution with observed net changes.
    - `Unavailable`: Diff or capture unavailable.
    - `Capturing`: Capture in progress.
  - **Conceptual differentiation of exclusions and omissions:** Paths excluded by policy (.git, node_modules, snapshot limits) do not add `[omissions]` to the header; their details remain accessible on demand in the compact info view (`d`).
- **Line 2 (Changes summary):** `│ +added / -removed` using Pi semantic tokens (`toolDiffAdded`, `toolDiffRemoved`, `dim`).
  - No changes: `│ No changes` in `dim` style.
  - Stats unavailable: `│ stats unavailable` in `dim` style.
- **On-demand details:** Toggleable via keyboard (`d`) or mouse click on header (`y === 0 || y === 1`).

### Footer (1 line)
- All in English, adaptable to dock width:
  - No selection (< 50 cols): `│ Enter: expand · a: append · Esc: editor`
  - No selection (< 75 cols): `│ Enter: expand · a: append · ↑↓: navigate · Esc: editor`
  - Standard (>= 75 cols): `│ Enter: expand · a: append · ↑↓: navigate · Esc: editor · d: details`
  - With selection (< 55 cols): `│ N lines selected · a: append`
  - With selection (>= 55 cols): `│ Sel: old:X, new:Y (N lines) · a: append to editor`
  - Active inspection mode (`i`): `│ i: <full path or raw line text>`

---

## 6. Selection and Context Transfer (Stage B)

### Selection Mechanics
- **Click:** Selects an individual diff line (added, deleted, or context).
- **Mouse drag (Drag):** Selects the continuous range of lines spanned.
- **Keyboard:** `Shift + ↑` and `Shift + ↓` extend or collapse selection range.
- **Hunk header:** Selecting an `@@` header marks the entire hunk.
- **Exact mapping:** Selection faithfully records `old` (original lines) and `new` (new lines) corresponding ranges.
- **Visual priority:** Background `selectedBg` or video inversion prevails over `toolDiffAdded` and `toolDiffRemoved`.

### Transfer to Native Editor
- **Shortcut `a`:** Appends selected snippet to the end of Pi's editor current draft.
- **No prefabricated prompts:** Fixed keywords like `FIX` or `DISCUSS` are not added. The user retains total freedom to formulate their request.
- **Total draft preservation:** Prior text in editor is kept intact (`previousDraft + "\n\n" + snippet`).
- **No auto-sending:** Sending or executing prompt is never called; user decides when to press `Enter`.
- **Automatic focus return:** Upon pressing `a`, focus returns immediately to Pi's native editor.
- **Dock persistence:** Dock remains mounted, visible, and with its files expanded.
- **Successive appending:** User can select another snippet from another file and press `a` again, cleanly concatenating multiple separated fragments.

### Transferred Context Format
```text
[src/utils/calculator.ts | diff | old:12-14 | new:12-15]
@@ -12,3 +12,4 @@
 function calculateTotal(items) {
-  return items.reduce(sum, 0);
+  const valid = items.filter(Boolean);
+  return valid.reduce(sum, 0);
 }
```
- Workspace-relative paths, never absolute.
- `old` and `new` ranges derived from actual selected lines.
- `+`, `-` prefixes and context spacing rigorously preserved.
- `@@` header included when a full hunk is selected.
- Discrete snippet separation (`\n\n`).
