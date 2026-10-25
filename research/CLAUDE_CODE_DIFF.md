# Technical Research — Claude Code `/diff` System (`mods/diff`)

**Research Date:** 2026-10-23
**Reference Repository:** `anthropics/claude-code`, directory `mods/diff`
**Status:** Strict documentary research (no runtime code modifications, M1 unaltered).

---

## 1. Introduction and Scope

This research analyzes the architecture and internal workings of Claude Code's `/diff` system, implemented as the integrated mod `mods/diff` (`cc-plugin-diff`). The purpose is to contrast its design decisions with our architecture (`../docs/RESEARCH.md`, ADR-003) and `pi-iteration-diff` requirements.

---

## 2. Detailed Analysis per Research Area

### 2.1. Capture and Reconstruction of Changes per Turn (`T1`, `T2`...)
- **Verified facts:** Claude Code organizes changes by agent turns (`T1`, `T2`, etc.) using engine recorders (`Record.recorderOf(engine)`) and centralized hook registrations in `mods/diff/hooks/register.ts` and `mods/diff/hooks/index.ts`.
- **Mechanism:** Whenever the agent executes editing tools or commands modifying the environment, the system records incremental state associated with agent turn, plus unified `Current` view.

### 2.2. Differences Between Git Working Tree and Turn History
- **Verified facts:**
  - `Current` reflects accumulated and uncommitted state of Git working tree (`git diff HEAD`).
  - Turn views (`T1`, `T2`, ...) isolate changes occurring in specific Claude execution turns.
- **Comparison with ADR-003:** ADR-003 defines by default the "last completed user iteration" as logical unit, recognizing that in Pi strict per-internal-model-turn attribution can be ambiguous due to retries and automatic continuations.

### 2.3. Backend Architecture, Panel State, and TUI Rendering
- **Verified facts:**
  - The mod is structured as a functional TypeScript plugin with hook submodules and dedicated tests (`mods/diff/tests/`).
  - Backend relies on Git abstractions (`gitBackendOf`, `GitDeps`) to compute diffs, manage baseline configurations, and probe modified paths.
  - Panel state (`PaneModel`) manages dock opening, navigation between files and hunks, and key-to-action mapping.
  - Rendering occurs in a right-hand side panel in fullscreen mode, autonomously managing its own scroll and events.

### 2.4. Updating Diffs During and After Execution
- **Verified facts:** Features a background update and polling pipeline (`isRefreshing`, `pinned.fetchDiff(model.requestedMode)`) triggered reactively or via events as Claude edits files (`write`, `edit`) and runs console commands (`bash`).

### 2.5. Handling Created, Modified, Deleted Files, and Changes via Bash
- **Verified facts:**
  - Git backend natively handles untracked (*created*), modified, and deleted files.
  - Changes produced by Bash commands (e.g., `npm install`, build scripts, redirections `>`, or external tools) modify working tree and reflect in `Current` view (and associate to corresponding turn if command was part of agent execution).
  - **Noise handling:** Automatically generated files and heavy lockfiles are filtered, listed separately, and collapsed by default to avoid cluttering interface.

### 2.6. Performance, Caching Strategies, and Resource Limits
- **Verified facts:**
  - Excessively large diffs are not rendered by default ("*Load diff / Large diffs are not rendered by default*"), preventing TUI main loop freezes or excessive memory consumption.
  - Caching of `fetchDiff` results implemented based on requested mode (`requestedMode`).

### 2.7. Change Selection and Context Transfer to Prompt
- **Verified facts:** Panel includes buttons and keyboard shortcuts linked to `ask` action, which injects diff of selected file or snippet directly into user's next prompt as armed context (*armed-ask*).

---

## 3. Classification of Findings

### 3.1. Reusable (Directly Applicable)
- **Noise and lockfiles filtering:** Group and collapse generated files or binaries/heavy lockfiles to improve side panel readability.
- **Rendering limits for massive diffs:** Adopt rule of not rendering giant diffs automatically to protect Pi TUI stability.
- **Modular plugin structure:** Separate diff logic, hooks, and rendering into clean, testable modules.

### 3.2. Adaptable (Requires Modifications due to Pi / Claude Code Differences)
- **Iteration model (ADR-003):** Adapt turn concept (`T1`, `T2`) to Pi's "last completed user iteration" model, due to differences in agent lifecycle (`agent_settled` vs individual LLM turns).
- **TUI integration and layout:** Adapt right side panel management using our layout adapter (`layout-adapter.ts`) over Pi TUI APIs, respecting native root without replacing main chat.

### 3.3. Non-Applicable (Depends on Claude Code Proprietary Infrastructure)
- **Internal engine recorders:** `Record.recorderOf(engine)` depends on Claude Code's internal event and engine architecture.
- **Claude plugin runner:** Use of `claude plugin test mods/diff` and associated engine hooks.

---

## 4. Separation of Verified Facts and Hypotheses

- **Verified facts:**
  - Existence and structure of `mods/diff` in Claude Code public repository.
  - Use of `gitBackendOf`, `fetchDiff`, `PaneModel`, and hook registration in `mods/diff/hooks/register.ts`.
  - Conceptual separation between `Current` (working tree) and turns (`T1`, `T2`).
  - Rendering restriction for large diffs and `ask` mechanism to inject context into prompt.
- **Hypotheses:**
  - Exact details of how backend persists merge-bases relative to default branch per repository in complex monorepo environments.

---

## 5. Concrete Recommendations to Evaluate Post-M1

1. **Noise evaluation in M2/M3:** Consider lightweight mechanism to collapse dependency files or lockfiles (`package-lock.json`, `pnpm-lock.yaml`) in side panel view.
2. **TUI performance protection:** Implement line or byte limit per file in diff viewer to prevent slowdowns with generated or minified files.
3. **Prompt transfer experience validation:** Contrast `ask`-style context injection with our M3 multiline range selection requirements.
