# AGENTS.md — Mandatory Agent Instructions

## 0. Mission and Scope Definition

Build `pi-iteration-diff`, a **lightweight Pi Coding Agent extension** to review via `/diff` the net changes from the **last user request**, at the end of that execution, in a **right-hand side panel adjacent to the conversation**, select lines/ranges, and append them **without automatic sending** to Pi's native editor. It must work both in common terminal mode and with Pi inside **Herdr**.

Before writing code, read in order: `AGENTS.md` → `docs/REQUIREMENTS.md` → `docs/RESEARCH.md` → `docs/milestones/PROGRESS.md`. Upon finishing each work block, update `docs/milestones/PROGRESS.md`.

**Mandatory product portability:** Linux, macOS, and native Windows in environments supported by Pi. Arch Linux is only the development environment; WSL is Linux, not evidence of native Windows. Maintain a shared snapshot engine with justified minimal adaptations; do not demand identical internal mechanisms. Document OS-specific security guarantees and partial states under unverified identity. CI must run integration on `ubuntu-latest`, `macos-latest`, and `windows-latest`; an unexecuted workflow is **NOT RUN**, never certified support.

**Main rule:** Do not expand scope or consider the project finished because "something similar already works." The product must meet the acceptance criteria, not merely display a `git diff` in a TUI.

## 1. Collaboration and Execution Rules

1. Implement **in small milestones**, with testing and evidence logging. Prioritize M0 (feasibility) before building extensive infrastructure.
2. Before touching a component, check if Pi offers a public API; use internals only in an isolated adapter with tests, documented version, and fallback.
3. Do not turn it into a fork of Pi/Herdr or integrally clone reference projects. Take ideas, not unreviewed code without checking licenses.
4. Do not run migrations, broad refactors, repository-wide formatting, massive updates, or changes outside the task.
5. If an approach fails, write hypothesis, minimum test, result, and next experiment. Do not accumulate speculative solutions or untested fallback layers.
6. Do not stop only after generating code: verify changes against acceptance and tests. Conversely, **do not iterate indefinitely**: close the milestone when its Definition of Done is satisfied.
7. Clearly flag environment blockages (without Pi, Herdr, or interactive terminal available) and do not invent tests.

## 2. Target Architecture

**Module Boundaries:**

```text
src/
  index.ts                  # extension registration, commands, wiring
  lifecycle/                 # baseline/final, sessions, events
  snapshots/                 # before/after contents, exclusions, limits
  diffs/                     # parsing, hunks, lines, sides, renames
  review/                    # selection, annotations, feedback staging
  ui/                        # layout adapter, dock, navigation, mouse/focus
  integrations/herdr/        # ONLY compatibility and future opt-in metadata
  core/                      # types, configuration, errors

tests/
  fixtures/                  # repositories and synthetic files
  ...                        # unit/integration tests and TUI harness
```

The structure is a **proposal**, not pre-existing directories. Simplify when actual code permits: modules by responsibility, not a folder for every meaningless file.

**Invariants:**

- `snapshots`, `diffs`, and `review` are mostly pure/testable; do not import Pi or Herdr in these layers.
- `ui` only presents the model and translates interactions; never decides what the agent modified based on rendered colors/text.
- `lifecycle` defines a logical user iteration, never confuse it with a single model `turn_end`.
- Interaction with internals `tui.layoutRoot` / `setLayoutRoot` is encapsulated in a single `layout-adapter.ts` with capability detection, ownership, and cleanup.
- All mutable state is delimited by **Pi session ID + repository/worktree root + iteration ID**. Do not mix panes or projects.
- Never write to the real Git index; never create commits or stashes to capture diffs.
- By default, the panel opens exclusively via `/diff` or `F6`. Automatic opening at the end of an iteration is permitted only if the user explicitly enabled `Auto-open after iteration` in `/diff-settings` (default **Off**). Never open during capture or due to intermediate events; do not steal editor focus, send messages, or alter drafts. Respect manual closures during the same iteration and do not present invalid or ambiguous captures as confirmed results.

## 3. Implementation Conventions

- TypeScript with `strict: true`, explicit types in public API, and no `any` except for documented isolated untyped API boundaries.
- Prefer small functions, predictable input/output, typed errors, and minimal dependencies; **do not incorporate React, Electron, or WebView**.
- Use Pi TUI tools to measure Unicode columns, handle styles, keyboard, scroll, and mouse; do not compute width as `string.length`.
- Cancellable async I/O when possible; configurable file, memory, depth, and time limits.
- English names for code/commands/API; project documentation and reports in English.
- Follow Pi's slash command convention. `/diff` is the explorer's sole main command and `F6` remains as shortcut; `/diff-settings` manages preferences. Register `/diff` **only if it does not collide** with another extension; report the collision without silencing or overwriting external commands. M3.5 must remove `/iteration-diff` from registration, without creating additional aliases.
- Do not rely on extension, name, tool stdout, or heuristics as a guarantee of file authorship.
- Render and capture must degrade safely under errors. Restore root/editor/focus and release resources.
- Feedback application: build a compact block with `path`, `side`, `line range`, `excerpt`, `intent`, and comment. Preserve previous text and draft order; do not auto-send and do not edit code directly.
- Tests for ANSI output, small terminal, combining characters, tabs, and emojis; do not depend on screenshots to verify diff data.
- Filesystem: do not substitute security with `realpath` prior to `open`. Validate descriptor, file/parent identity, and limits before/after reading; log detected races as partial. Do not promise exclusion of adversarial ABA races with Node APIs. Preserve additional OS-available checks and document limits, without three independent engines.

## 4. Data and User Machine Protection

- **Never**: `git reset`, `git clean`, `git stash`, `checkout --`, changes to global config or installed extensions without explicit consent. `git add` and `git commit` are permitted only under the commit policy in section 7, limited to the project's own files.
- Do not persist full code content, secrets, or diffs by default in shared places/logs. If temporary snapshots are needed, store them with restricted permissions, limits, and API-level secure deletion (without promising unrecoverable physical deletion).
- Respect `.gitignore` and configured exclusions; clearly specify untracked and outside-repo scope.
- Do not indiscriminately read `$HOME`, sensitive directories, internal `.git`, or huge files. No telemetry, network, or analytics by default.
- Do not modify the user's real Pi/Herdr installation to run automated tests. Use a temporary `PI_CODING_AGENT_DIR` and an isolated fixture repo when possible.
- Do not interfere with Herdr's `herdr-agent-state.ts` or `idle/working/blocked` states.

## 5. Tools, Scripts, and Commands

**Current status:** documentation only. **No `package.json`, test suite, or executable project commands exist yet**. In the first milestone creating the scaffold, define these scripts in `package.json` and make them work (Node + TypeScript; preference for `node:test`, `tsx`, and `tsc` before adding large frameworks):

```bash
npm install             # once package.json is defined
npm run typecheck       # tsc --noEmit
npm test                # automated suite: unit + automatable integration
npm run check           # typecheck + test (gate for each milestone)
```

To manually test the extension, **once `src/index.ts` exists and is loadable**:

```bash
pi --tui-mode fullscreen -e ./src/index.ts
```

If Pi's current CLI does not accept that form, check `pi --help` and adjust documentation. For Herdr: check `herdr --version`, `herdr integration status`, and open Pi in a pane of a test instance; **do not install or overwrite the integration** unless authorized.

**Requirements for added tests:**

- Fixtures inside temporary directories (`mkdtemp`) with cleanup in `finally`.
- Unit tests: net snapshot, added/removed lines, path normalization, filters, selection, and prompt.
- Integration: repository with prior modifications, two iterations, shell writes, intact index, session changes.
- Manual: Pi fullscreen, Herdr, mouse, focus, resize, and `Ctrl+C`/`/reload`.
- Record real Node, Pi, Herdr, and terminal version in each manual test.

## 6. Milestone Protocol

Each milestone must produce:

1. **Observable objective**, concrete files, and small scope.
2. Test evidence (`command`, real result, environment, date). Distinguish `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`.
3. Update to `docs/milestones/PROGRESS.md`: what changed, tests, failures, next step, and risks.
4. If a requirement/decision changes, update `docs/REQUIREMENTS.md`/`docs/RESEARCH.md` with reason, without deleting history.
5. Do not announce "finished" if there are unexecuted mandatory tests or unfulfilled acceptance.

**Sequence:** M0 TUI/mouse/lifecycle feasibility → M1 snapshots → M2 diff + review → M3 editor & drag/feedback → M4 Herdr & robustness → M5 packaging/documentation.

## 7. Git Policy and Conventional Commits (Mandatory)

- **All commit messages must be in English** and follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `type(scope): concise imperative description`.
- Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`, `revert`. Use `!` or a `BREAKING CHANGE: ...` footer only for effectively incompatible changes.
- `scope` is optional, but preferable when adding context: `ui`, `diff`, `snapshots`, `review`, `lifecycle`, `herdr`, `tests`, `docs`.
- Subject in English, imperative mood, lowercase initial, no period at the end, concise (ideally <= 72 characters for the entire first line).
- Correct examples:
  - `feat(ui): add manually opened diff sidebar`
  - `feat(snapshots): isolate changes per user iteration`
  - `fix(review): preserve existing editor draft`
  - `test(lifecycle): cover interrupted agent runs`
  - `docs: record Herdr compatibility constraints`
- Each commit must represent **a logical, verifiable change**. Do not combine implementation, independent refactors, and unrelated cosmetic changes. Avoid empty commits, artificial progress commits, or commits for every tiny edit.
- Before committing: run `git status --short`, review `git diff` and `git diff --cached`, run available checks (`npm run check` when it exists), and record real results in `docs/milestones/PROGRESS.md`. Do not claim PASS if they were not executed.
- Add only files related to the task, **via explicit paths** (`git add -- path/to/file`); never `git add -A`, `git add .`, or `git commit -a` without permission. Do not include secrets, generated artifacts, logs, snapshots, or previous user changes.
- Creating local commits of project changes once verified is permitted, **if the repository is already initialized and the user did not request avoiding commits**. Do not run `git push`, create tags, rewrite history, amend, rebase, or modify Git configuration without explicit authorization.
- If there are foreign modifications, foreign staged changes, conflicts, failed hooks, or the repository is not initialized: **do not force or clean state**; document the blockage and leave own files uncommitted when unable to isolate them securely.
- Do not commit until the work block has a coherent and verifiable result. In the final report, report short hash, message, executed tests, and any limitations; if there was no commit, explain why.
- The extension's code must **never** execute `git add` or `git commit` to operate, capture snapshots, or compute diffs. This policy applies exclusively to the agent *developing this repository*.

## 8. Global Definition of Done (Non-Negotiable)

The project is considered completed only when:

- Manual `/diff` opens/closes a right-side dock with conversation and native editor operational in Pi fullscreen; `F6` continues as shortcut. It does not auto-open by default; automatic opening requires explicit consent via `Auto-open after iteration` in `/diff-settings` and fulfills section 2 opening guarantees.
- By default, it shows only the **net delta of the last completed request**, separating it from prior uncommitted work. Includes results from `write`, `edit`, and shell commands.
- Lines and ranges can be selected with keyboard and mouse in fullscreen, selection is preserved when navigating, and **multiple** snippets can be added to the prompt with `FIX`/`DISCUSS` without clearing draft or auto-sending.
- The **drag ranges to editor** flow was tested; if terminal protocol prevents it in the target environment, document the limitation with evidence, offer a single-action alternative, and **do not declare full parity** without user approval.
- Works in Pi without Herdr and inside Herdr without breaking official integration, mouse, focus, resize, and layout recovery.
- Test suite and typecheck pass; engine integration actually executed on Linux, macOS, and native Windows (separate WSL), with explicit guarantees/limitations per OS; mandatory manual tests logged, without regressions or Git index changes.
- Documentation for installation, usage, limits, and compatibility updated; `docs/milestones/PROGRESS.md` records DoD evidence.

Read verifiable criteria and complete roadmap in `docs/REQUIREMENTS.md`.
