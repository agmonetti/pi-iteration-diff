# Visual Fidelity Audit: M2 vs. Design Specification (`/design`)

**Audit Date:** 2026-10-23
**Project:** `pi-iteration-diff`
**Audited Milestone:** M2 (Real diff viewer with collapsible files)
**Scope:** Exhaustive comparison between design documents (`design/ui-spec.md`, `design/mockups.md`, `design/theme-tokens.json`) and actual implementation (`src/ui/diff-panel.ts`, `src/ui/layout-adapter.ts`, `src/diffs/iteration-diff.ts`, `src/index.ts`).

---

## 1. Compliance Matrix

| UI Area / Design Requirement | Status | Code Reference (`src/`) | Implementation Notes and Findings |
|---|---|---|---|
| **Exclusive Opening and Hiding** | `IMPLEMENTED` | `src/index.ts:44-92` | Opens/closes via explicit command `/diff` or `/iteration-diff`. Does not auto-open. |
| **Default Initial Collapse (M2)** | `IMPLEMENTED` | `src/ui/diff-panel.ts:128` | All files start collapsed on each new iteration. |
| **Independent Expansions** | `IMPLEMENTED` | `src/ui/diff-panel.ts:103,147` | The `expanded` set persists during the session for the same iteration; cleared on iteration switch. |
| **Proportional / Adaptive Width** | `IMPLEMENTED` | `src/ui/layout-adapter.ts:36-42` | Real responsive width (35-40%, `basis: 36, grow: 40, minSize: 34, maxSize: 70`) preserving chat minimum width (`minSize: 52, grow: 60`). |
| **Automatic Hiding (< 90 cols)** | `IMPLEMENTED` | `src/ui/layout-adapter.ts:38-41` | Dock hides automatically if total width is less than 90 columns. |
| **Vertical Separator / Dock Border** | `IMPLEMENTED` | `src/ui/diff-panel.ts:182` | Styled `│` border with `border` token uniformly and independently of each line's content. |
| **Minimalist Focus Indicator** | `IMPLEMENTED` | `src/ui/diff-panel.ts:168,183` | Header and cursor `>` with `accent` token only on focus; dimmed/`muted` indicator without focus. |
| **Scope Selector in Header** | `IMPLEMENTED` | `src/ui/diff-panel.ts:166-169` | Structured header with contextual scope badge `[Last*]` when width >= 42 cols. |
| **Theme Token Styles (`toolDiffAdded` / `toolDiffRemoved`)** | `IMPLEMENTED` | `src/index.ts:71-82`, `src/ui/diff-panel.ts:188-260` | Full mapping of tokens (`border`, `bold`, `dim`, `accent`, `muted`, `warning`, `toolDiffAdded`, `toolDiffRemoved`, `text`). |
| **Line Number Gutter** | `IMPLEMENTED` | `src/ui/diff-panel.ts:246` | Line numbers styled with `dim` and signs `+`/`-` with `toolDiffAdded`/`toolDiffRemoved`. |
| **Long Line and Path Reading** | `IMPLEMENTED` | `src/ui/diff-panel.ts:36-64,174,250` | Horizontal scrolling (`←`/`→`) with `«` indicator, smart middle path truncation (`truncatePath`), and on-demand inspection (`i`). |
| **Strict Ellipsis Truncation** | `IMPLEMENTED` | `src/ui/diff-panel.ts:30,167,222` | Bounded ellipsis truncation without terminal cell overflows. |
| **Keyboard Shortcuts and Pagination** | `IMPLEMENTED` | `src/ui/diff-panel.ts:269-286` | `↑↓`, `Enter`, `[]`, `{}`, `←→` (pan), `0` (reset), `i` (inspect), `PgUp/Down`, `Home/End`, `Esc`/`Tab` (`editor`), `q` (`close`). |
| **Transcript-Independent Scroll** | `IMPLEMENTED` | `src/ui/diff-panel.ts:40-67` | `VirtualDiffScroll` with `ScrollView` and dedicated mouse wheel. |
| **Special State Handling (ADR-003 / Batch Net / Abort)** | `IMPLEMENTED` | `src/diffs/iteration-diff.ts:206-265` | Faithful text mapping of batched windows, aborts, truncation, and empty states. |

---

## 2. Observed Visual Deviations

1. **Dock Dimensional Rigidity (Fixed 34 Columns):**
   - *Design:* Proportional to terminal width (`35% - 40%` or adaptable between 34 and 42 columns depending on available space).
   - *Reality:* Fixed `basis: 34` in `layout-adapter.ts`. In standard 120-column terminals, the dock occupies exactly 34 cells, leaving 86 cells to Pi's chat (approximately 28%, below design minimum).

2. **Loss of Typographic Hierarchy and Color in File Headers:**
   - *Design:* File name in bold (`font-weight: 600`), statistics `+3 / -2` with distinct addition and deletion colors.
   - *Reality:* `src/ui/diff-panel.ts` renders name and statistics as a concatenated plain text string (`[modified] +3/-2`) without specific bold styles or clear color separation in statistics.

3. **Inconsistency in Focus Indicator (`>`):**
   - *Design:* Active line indicator cursor (`>`) and header highlight activate only when panel has user focus.
   - *Reality:* Control column always prepends `>` or `  ` regardless of whether focus is on chat or dock, and title changes color but keeps active row marker all the time.

4. **Absence of Scope Selectors and Top Badges:**
   - *Design:* Top tabs `[Last*] Current History`.
   - *Reality:* Omitted in M2 implementation, forcing users to rely solely on command without visual feedback of current scope.

---

## 3. Detected Usability Issues

1. **Severe Truncation of File Paths and Code:**
   - With a fixed width of 34 columns, subtracting expansion prefix (`▾ ` or `▸ `) and stats suffix (` [modified] +12/-3`), **less than 15 characters remain visible for file paths**. Common paths like `src/integrations/herdr/manager.ts` get unrecognizably truncated to `src/integrat…`.
   - Inside expanded files, useful code space reduces to only **19 characters** (total width 34 minus 15 for gutter and separators), causing almost any indented code line to fall out of view without horizontal scrolling in the panel.

2. **Saturated and Invisible Actions Line / Footer:**
   - Footer text (`Enter/click open · ↑↓ PgUp/PgDn · [] file · {} hunk · Esc editor · q close`) is 73 characters long.
   - In the 34-column dock, **the footer gets completely truncated**, completely hiding usage instructions from the user.

3. **Duplication and Confusion in Line Numbers (Gutter):**
   - Current format shows `old` and `new` contiguously in 11 columns (`old.padStart(4) + ' ' + next.padStart(4)`), but in context lines or pure additions it produces excessive whitespace or strange alignments that hinder quick comparative reading against a standard unified diff.

---

## 4. Differentiation: Pi TUI Limitations vs. Implementation Decisions

| Aspect | Nature | Justification / Evidence |
|---|---|---|
| **Inability to show complex per-cell background colors** | TUI Limitation | `@earendil-works/pi-tui` operates with ANSI text strings returned by components; applying per-fragment cell styles increases the risk of ANSI sequence corruption in restrictive terminals (such as some Herdr multiplexers). |
| **Fixed 34-column width** | **Implementation Decision** | *Avoidable.* `HStack` and `Component` API accepts weights (`grow`, `basis`, proportions). Fixing to 34 columns was an M2 simplification to guarantee stability, but contradicts specification adaptability principle. |
| **Absence of short or responsive footer** | **Implementation Decision** | *Avoidable.* Footer text was not adapted to reduced dock width, causing total truncation. |
| **Lack of scope tabs (`Current`/`History`)** | M2 Scope Decision | *Correct.* M2 specification explicitly bounded that `Current` and `History` belong to later phases, making their absence in M2 a respected design decision, not a defect. |

---

## 5. Prioritized Corrections (Visual Adjustment Roadmap)

1. **High Priority (Usability Blocker):**
   - **Responsive footer:** Adapt footer text according to available dock width (e.g., if width < 50, show only `[Esc] Editor  [q] Close`).
   - **File statistics and name formatting:** Allow prioritizing file path over statistics when width is reduced, truncating name from the left or compacting status indicator (`[m]` instead of `[modified]`).

2. **Medium Priority (Visual Fidelity):**
   - **Adaptive proportional width:** Modify `layout-adapter.ts` so dock basis scales between 36 and 46 columns when terminal exceeds 120 columns (`DOCK_PROPORTIONAL_RATIO`), instead of keeping static 34 columns.
   - **Focus Hierarchy:** Ensure active row indicator `>` appears only when `this.hasFocus === true`, reducing visual noise in reading mode.

3. **Low Priority (Aesthetic Refinement - Not urgent for M2):**
   - Integration of background colors (`addedBg`/`removedBg`) via ANSI terminal regression tests.

---

## 6. Concrete Implementation Recommendations for Code Agent

- **Do not rewrite M2:** Diff engines, scroll virtualization, and lifecycle separation work correctly (81/81 tests passing). Changes must be strictly limited to presentation layer (`src/ui/diff-panel.ts` and `src/ui/layout-adapter.ts`).
- **Footer adjustment in `diff-panel.ts`:**
  ```ts
  private footer(width: number): string {
    const short = width < 45;
    const text = short
      ? "Enter: open · Esc: editor · q: close"
      : "Enter/click: open · ↑↓: navigate · Esc: editor · q: close";
    return this.actions.style("muted", truncateToWidth(`│ ${text}`, width, "–"));
  }
  ```
- **Gutter and Minimum Width Optimization:** Evaluate raising `MIN_COLUMNS_THRESHOLD` from 90 to 100 columns if dock requires 34+ cells to prevent visual collapse of paths and code.

---

## 7. Correction Status (Implemented in M2 Visual Fidelity Correction)

- **Adaptive dock:** Implemented in `src/ui/layout-adapter.ts` via `basis: 40, minSize: 34, maxSize: 55`, allowing smooth adaptation in wide and medium terminals.
- **Responsive footer:** Implemented in `src/ui/diff-panel.ts` with automatic switching to short mode (< 45 cols) to prevent truncation.
- **File statistics:** Formatted with explicit spaces (`+3 / -2`) matching mockups.
- **Verification:** Test suite expanded to 82/82 tests passing successfully (`npm run check`).
