# REQUIREMENTS.md — Product Specification and Implementation Plan

**Provisional Name:** `pi-iteration-diff`
**Type:** TypeScript extension for Pi Coding Agent (Herdr-compatible)
**Status:** v0.1 specification — pending feasibility spikes
**Product Priority:** Review the diff of the *last user iteration* without breaking the conversational flow.

## 1. Problem and User

The user frequently uses Pi inside Herdr and wants Claude Code's diff review visual experience: conversation on the left, diff on the right, selecting portions of code and returning them to the prompt. Tools showing diffs **during** execution or opening a fullscreen modal do not solve the problem. `git diff HEAD` doesn't either: it mixes prior changes unrelated to the last request.

### Interaction Principle

> "Pi's execution finishes → I type `/diff` when I want → I see exactly what changed in that iteration (observed net) → I select lines → I take them to the prompt to request corrections or discuss them."

The system must not interrupt the agent to show a diff or trigger messages automatically.

## 2. Terminology and Semantic Contract

- **User iteration:** explicit user request and associated automated work sequence. Not equivalent to a model `turn_end`.
- **Before snapshot / after snapshot:** representation of workspace content at the start and close of a user iteration.
- **Iteration diff:** observed net difference `after - before`, independent of `HEAD`.
- **Current diff:** current working tree differences against base Git, with scope announced in UI.
- **Review item:** fragment/range and typed comment `FIX` or `DISCUSS`, located on `old` or `new` side.
- **Staged feedback:** review items representation prepared but **not yet sent**.

If another extension modifies files between snapshots, third-party changes may appear. Do not claim perfect causality.

## 3. Functional Requirements (P0 = Essential MVP)

| ID | Priority | Requirement | Observable Acceptance |
|---|---|---|---|
| FR-01 | P0 | Register manual `/diff`. | Executing it opens/closes the panel; no automatic opening by default. M3.5 allows explicit opt-in in `/diff-settings`, only after complete individual result and without stealing focus. |
| FR-02 | P0 | Dock to the right of conversation in Pi fullscreen. | Chat and original editor remain visible, normal focus and input. |
| FR-03 | P0 | Diff of the last completed request as default option. | Prior uncommitted changes do not appear when reviewing the last iteration. |
| FR-04 | P0 | Capture net change by content, not just `edit`. | Changes from `write`, `edit`, `bash`, and external scripts observed during request appear. |
| FR-05 | P0 | Navigation between files, hunks, and lines. | Indicators +/−, paths, keyboard navigation, scroll, unified view. |
| FR-06 | P0 | Line/range selection. | In fullscreen: keyboard and mouse selection, including added and deleted lines. |
| FR-07 | P0 | Append snippets to prompt. | Explicit action adds multiple snippets with file/line context; preserves existing text and does not auto-send. |
| FR-08 | P0 | `FIX` and `DISCUSS` instructions. | Prompt distinguishes requested modification from question/discussion. |
| FR-09 | P0 | Repo integrity. | Index, commits, branches, staging, and project files are not altered by inspecting diff. |
| FR-10 | P0 | No changes. | `/diff` reports "No changes in the last iteration" without inventing diff. |
| FR-11 | P0 | Variable height/width and fallback. | Resizing preserves conversation/editor; insufficient width activates accessible view, without crash. |
| FR-12 | P0 | Compatible with standalone Pi and Pi in Herdr. | Approved manual matrix, especially mouse/focus/scroll. |
| FR-13 | P0 | Handle command/layout conflicts. | Does not step on `/diff` or `layoutRoot` owned by another extension; reports collision and preserves F6. M3.5 removes `/iteration-diff`, without new aliases. |
| FR-14 | P0 | Safe cancellation/closure. | `/reload`, `Ctrl+C`, session change, or closure leaves no root or mouse captured. |
| FR-15 | P0 | Maintain scope per session/worktree. | Does not mix snapshots of different repos, worktrees, or sessions. |
| FR-16 | P1 (UX parity) | Drag fragment from diff to editor. | Drag → drop in editor appends correct range and leaves draft intact; if terminal blocks this interaction, save evidence and offer single-action fallback, without calling that UX "complete". |
| FR-17 | P1 | `Last iteration` / `Current` / `History` selector. | Labels show source and base with precision; switching iterations does not mix scopes. |
| FR-18 | P1 | Unified and side-by-side views. | Identity `old/new` and line numbers preserved in both. |
| FR-19 | P1 | Handle untracked, renames, deletions, binaries, and large files. | Explicit fallback; do not consume unlimited memory. |
| FR-20 | P1 | Exclusions, size, and retention config. | Documented secure defaults, no secrets/logs by default. |
| FR-21 | P1 | Persistence or controlled recovery. | Defined policy for `/reload`, crash/resume, and without unauthorized code exposure. |
| FR-22 | P2 | Optional metadata for Herdr. | "Review ready" without overwriting official states; disabled by default. |
| FR-23 | P2 | Comments per file/global diff and templates. | Feedback remains compact, editable, non-automatic. |

**MVP success criteria:** FR-01 to FR-15. **Full product success:** MVP + FR-16 to FR-21, or a documented exception approved by the user for a real drag-and-drop blockage. FR-22/23 are nice-to-have.

## 4. Non-Functional Requirements

- **NFR-01 — Weight:** no Electron, embedded browser, resident service, or Pi/Herdr modification.
- **NFR-02 — Performance:** upon run completion, do not perceptibly block the editor; expensive operations async and cancellable. Establish thresholds with real measurements in M1, not promising arbitrary figures.
- **NFR-03 — Containment:** limits for snapshots, diffs, number of files, lines, and retention. Warn if diff is incomplete; never hide truncation.
- **NFR-04 — Security:** no telemetry or network, secrets out of logs, content persistence disabled by default, restrictive permissions on temporals.
- **NFR-05 — Robustness:** runtime without crash on resize, disconnected terminal, cwd/branch changes, deleted files, or invalid codecs.
- **NFR-06 — Terminal accessibility:** all essential interactions via keyboard, clear visual selection, correct ANSI/Unicode/emoji/tab.
- **NFR-07 — Compatibility:** version Pi internal adapter and test on supported real versions; Herdr optional.
- **NFR-08 — Transparency:** differentiate "observed net delta" from "changes unequivocally caused by Pi."
- **NFR-09 — Completion:** a milestone closes when it meets its checks. Do not expand scope for unrequested cosmetic optimizations.
- **NFR-10 — P0 Portability:** product must capture/compare ordinary files on Linux, macOS, and native Windows within environments supported by Pi. Arch Linux is only the development environment; WSL does not certify Windows. A shared engine, with demonstrated minimal adaptations and particular security guarantees documented. Maintain limits, exclusions, verified identity, and partial results under uncertainty; do not claim equivalence of mechanisms against races. Mandatory gate: real integration on `ubuntu-latest`, `macos-latest`, and `windows-latest`, with create/modify/delete, pre-existing, paths/Unicode/case/separators, symlinks/junctions where applicable, worktrees, limits, cancellation, and intact Git. Without real execution: NOT R…

## 5. User Stories / BDD Scenarios

### US-01 — Isolated Last Iteration

**Given** a repo where `config.ts` was already modified,
**and** iteration A modifies `auth.ts`,
**and** iteration B modifies `users.ts`,
**when** I finish B and run `/diff`,
**then** only B's net changes in `users.ts` are shown; `config.ts` and `auth.ts` are excluded from `Last iteration`.

### US-02 — Shell Writes

**Given** a baseline of `schema.json`,
**when** Pi uses `bash` to generate or edit that file during the request,
**then** `/diff` detects it even though it didn't pass through the `edit` tool.

### US-03 — Feedback Without Losing Text

**Given** the draft `Add tests to module`,
**when** I select ranges in two files and mark one `FIX` and another `DISCUSS`,
**then** the insertion keeps the draft, adds both exact references, and does not send the message until I do so.

### US-04 — Mouse and Keyboard

**Given** Pi fullscreen inside Herdr,
**when** I drag over three lines of the diff,
**then** the model stores only that range, does not resize Herdr, and does not accidentally copy external text. The same selection is possible without mouse.

### US-05 — Drop in Editor

**Given** a selected range in the panel,
**when** I drag it over Pi's editor,
**then** the range is incorporated into the draft without deleting text or sending it. If this path does not exist in some terminal, the agent must document the negative test and offer `Select → Add to prompt` as an alternative path, without declaring the literal requirement fulfilled.

### US-06 — State and Cleanup

**Given** the panel open and with selection,
**when** I run `/reload`, close the session, or reduce Herdr size,
**then** Pi preserves editor operation; layout is restored or degraded cleanly, without lost inputs.

### US-07 — User Without Changes

**Given** an explanation-only prompt, without file changes,
**when** I run `/diff`,
**then** a clear empty state appears and no prior file figures as part of the request.

### US-08 — Concurrent Changes

**Given** that an external tool changes a file during the run,
**when** the iteration diff is obtained,
**then** the system reports these are changes observed in the window, not certainty of authorship. If baseline was incomplete, truncation is not hidden.

## 6. UI Contract (Proposal, Validate Visually)

```text
┌────────────── Pi conversation + native editor ──────────────┬──────── Diff review ────────┐
│ user: refactor auth                                        │ Last iteration ▾            │
│ assistant: ...                                             │ src/auth.ts     +12 / -4   │
│ tool output: ...                                           │ src/api.ts      +3 / -1    │
│                                                            ├────────────────────────────┤
│                                                            │ @@ ...                     │
│                                                            │ + 42 ...                   │
│                                                            │ + 43 ...  ← drag/select    │
│                                                            │ - 44 ...                   │
├────────────────────────────────────────────────────────────┴────────────────────────────┤
│ > draft preserved + [selected excerpts]                                                │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Default:** panel hidden; `/diff` toggles it.
- **Default source:** `Last iteration` (last *completed*). If agent is busy, indicate last completed result and current state, without mixing states.
- **Input:** keyboard always available; mouse inside fullscreen; click or shortcut `Add to prompt`; cross-pane drag-to-editor when spike passes.
- **Fallback:** if stable split capability does not exist, use temporary explicit review view and warn that panel parity is absent, not simulating fulfillment.
- **Width:** design adaptive thresholds based on real viewport measurements, not external window width when Herdr reserves sidebar.
- **Accessibility:** key help bar, visible focus, correct cursors.

## 7. Tentative Data Model (Proposal, Not Stable API)

```ts
interface IterationId {
  sessionId: string;
  workspaceRoot: string; // resolved/normalized
  sequence: number;
}

interface IterationCapture {
  id: IterationId;
  startedAt: string;
  finishedAt?: string;
  status: 'capturing' | 'complete' | 'partial' | 'cancelled';
  beforeRef: string;  // opaque snapshot reference, no code embedded in session log
  afterRef?: string;
  warnings: string[];
}

interface DiffRangeSelection {
  filePath: string;
  side: 'old' | 'new';
  startLine: number;
  endLine: number; // inclusive
  text: string;
  intent: 'fix' | 'discuss';
  comment?: string;
}
```

Can be revised after spike. Include snapshot/diff identifier in a selection to detect stale comments when a subsequent iteration modifies the file.

## 8. Roadmap and Gates

| Milestone | Deliverable | Exit Gate |
|---|---|---|
| **M0 — Feasibility** | Minimum prototypes: TUI split, mouse inside/outside Herdr, intact editor, correct event identification; compatibility matrix. | Reproducible PASS/FAIL evidence; confirmed ADR and explicit open risks. |
| **M1 — Capture** | Shared Linux/macOS/Windows before/after engine, fixtures, security/exclusions, per-session/worktree separation. | US-01, 02, 07, 08 automated; no Git mutation; NFR-10 with real native CI across all three OS. |
| **M2 — Viewer** | Structured diff, dock, navigation, empty/error states, narrow fallback. | FR-01–05, 10, 11, 13 pass. |
| **M3 — Selection/Feedback** | Mouse/keyboard range, FIX/DISCUSS, prompt appending, drag-to-editor researched and implemented where viable. | US-03, 04, 05; no overwriting or auto-sending. |
| **M3.5 — Diff Settings & Command Cleanup** | Six preferences via `/diff-settings`; `/diff` and F6 without old alias. | Defaults/validation/persistencia per branch; presentation without altering identity/selection; opt-in auto-open only valid final without focus; regressions and check PASS. |
| **M4 — Herdr/Robustness** | Real test matrix, resize, pane zoom, session switch/reload, conflicts, limits/benchmark. | US-06, FR-12–15, relevant NFRs. |
| **M5 — Distribution** | Installable Pi package, README, setup, troubleshooting, compatibility, and release checklist. | `npm run check` PASS; evidence of all scenarios, reproducible installation instructions. |

**Non-negotiable order:** do not skip M0 and implement a massive engine without demonstrating that TUI and editor support target interaction.

## 9. Minimum Test Plan

### Unit / Automated

- Baseline with dirty files and untracked prior to start.
- A → B with correct diffs, empty iteration, and revert of change within same run (net delta = zero).
- `bash`/script modifies files; concurrency with external files; partial capture handling.
- Files new/deleted/renamed, whitespace, CRLF, Unicode, binaries, symlink, submodule/worktree.
- Parsing old/new lines, inverted selection, multi-line ranges, multiple annotations.
- Compound prompt with existing text, no replacements, no auto-sending.

The architectural justification and links are in `RESEARCH.md`. Propositions marked "proposal" require validation; no internal API should be treated as a stable contract without tests in Pi's real version.
