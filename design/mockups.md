# Visual Mockups: pi-iteration-diff

Graphical representation using terminal characters (standard width: 120 columns).

> **Scope note:** The right panel mounts as a Pi extension preserving conversation and native editor on the left. Initial dock target width is 45% of the terminal. In the native editor, the existing draft is fully preserved. Action `a` appends the selected snippet and automatically returns focus to the editor, without auto-sending or prefixed FIX/DISCUSS commands.

---

## 1. Initial Explorer (Collapsed Files, Two Lines per Header)

When opening a new iteration via `/diff`, all files start collapsed. Each file header consists of two lines:
1. First line: Expansion indicator (`▸`), file name in bold, status (`[modified]`, `[created]`, `[deleted]`), and line statistics (`+3 / -2`).
2. Second line: Workspace-relative path indented (`  src/...`).

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF · Last iteration · 3 files (+11 / -6)            │
│                                                            │ ├───────────────────────────────────────────────────────┤
│ User: Optimize rate calculation and adjust tests           │ │ > ▸ calculator.ts [modified] +3 / -2                  │
│                                                            │ │     src/utils/calculator.ts                           │
│ Agent: I modified `calculator.ts` to cache results         │ │   ▸ rate.ts [created] +8 / -0                           │
│ and updated `calculator.test.ts`.                          │ │     src/core/rate.ts                                  │
│                                                            │ │   ▸ legacy.ts [deleted] +0 / -4                       │
│                                                            │ │     src/legacy.ts                                     │
│                                                            │ ├───────────────────────────────────────────────────────┤
│ PI EDITOR (Intact draft)                                   │ │ a: append · Enter/click: toggle · ↑↓: navigate · q: close│
│ >                                                          │ │                                                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```

---

## 2. Independently Expanded Files and Line Selection (Unified Diff)

Pressing `Enter` or clicking on a header expands its unified content. Multiple files can remain open.
Since M4.1, the gutter shows a single fixed contextual number: old in deletions, new in additions and context. Full old/new references are preserved in the model and upon appending. Selected code has **absolute visual priority** (`selectedBg` / highlight):

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF · Last iteration · 3 files (+11 / -6)            │
│                                                            │ ├───────────────────────────────────────────────────────┤
│ User: Optimize rate calculation and adjust tests           │ │ ▾ calculator.ts [modified] +3 / -2                  │
│                                                            │ │   src/utils/calculator.ts                             │
│ Agent: I modified `calculator.ts` to cache results         │ │   @@ -12,3 +12,4 @@                                   │
│ and updated `calculator.test.ts`.                          │ │   11   11   function calculateTotal(items) {          │
│                                                            │ │ > 12   12 - ████ return items.reduce(sum, 0);         │
│                                                            │ │ > 12   13 + ████ const valid = items.filter(Boolean); │
│                                                            │ │ > 13   14 + ████ return valid.reduce(sum, 0);         │
│                                                            │ │   14   15   }                                         │
│                                                            │ │                                                       │
│                                                            │ │ ▸ rate.ts [created] +8 / -0                           │
│                                                            │ │   src/core/rate.ts                                    │
│ ├────────────────────────────────────────────────────────────┤ ├───────────────────────────────────────────────────────┤
│ PI EDITOR (Intact draft)                                   │ │ Sel: old:12, new:12-14 (3 lines) · a: append to editor│
│ >                                                          │ │                                                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```

---

## 3. Context Transfer to Native Editor (`a`)

Pressing `a` formats the selected snippet and appends it to the end of the native editor draft, automatically returning focus to the editor (`Pi Editor`). The dock remains open:

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF · Last iteration · 3 files (+11 / -6)            │
│                                                            │ ├───────────────────────────────────────────────────────┤
│ User: Optimize rate calculation and adjust tests           │ │ ▾ calculator.ts [modified] +3 / -2                  │
│                                                            │ │   src/utils/calculator.ts                             │
│ Agent: I modified `calculator.ts` to cache results...      │ │   @@ -12,3 +12,4 @@                                   │
│                                                            │ │   11   11   function calculateTotal(items) {          │
│                                                            │ │   12   12 - return items.reduce(sum, 0);              │
│                                                            │ │   12   13 + const valid = items.filter(Boolean);      │
│                                                            │ │   13   14 + return valid.reduce(sum, 0);              │
│                                                            │ │   14   15   }                                         │
│                                                            │ │                                                       │
│                                                            │ │ ▸ rate.ts [created] +8 / -0                           │
│                                                            │ │   src/core/rate.ts                                    │
│ ├────────────────────────────────────────────────────────────┤ ├───────────────────────────────────────────────────────┤
│ PI EDITOR (Active focus; draft preserved and enriched)     │ │ [F6] Focus Diff · [Esc] Dismiss                       │
│ > My previous instruction                                  │ │                                                       │
│                                                            │ │                                                       │
│ [src/utils/calculator.ts | diff | old:12 | new:12-14]      │ │                                                       │
│ - return items.reduce(sum, 0);                             │ │                                                       │
│ + const valid = items.filter(Boolean);                     │ │                                                       │
│ + return valid.reduce(sum, 0);                             │ │                                                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```

---

## 4. Batched Window State (Contextual Batch Net)

When multiple messages were queued during agent execution:

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF · Batch Net · 2 files (+4 / -1) [batched queue]  │
│                                                            │ ├───────────────────────────────────────────────────────┤
│ User: Fix the typo                                         │ │ ▾ typo.ts [modified] +1 / -1                          │
│ User: And add the test                                     │ │   src/typo.ts                                         │
│ Agent: I applied both corrections...                       │ │                                                       │
│                                                            │ │ ▸ typo.test.ts [created] +3 / -0                      │
│                                                            │ │   tests/typo.test.ts                                  │
│ ├────────────────────────────────────────────────────────────┤ ├───────────────────────────────────────────────────────┤
│ PI EDITOR                                                  │ │ a: append · Enter/click: toggle · Esc: editor · q: close│
│ >                                                          │ │                                                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```
