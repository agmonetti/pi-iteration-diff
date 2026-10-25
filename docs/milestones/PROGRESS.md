# PROGRESS.md — Project Living Log

**Project:** `pi-iteration-diff`
**Last Updated:** 2026-10-23
**General Status:** `M1 ACCEPTED — CROSS-PLATFORM CI PASS`
**Active Milestone:** M1 closed; stopped before M2; UI frozen
**Product Version:** 0.0.0 private; synthetic prototype, not product.

## 1. Status Summary

- **Completed in this block:** local API research; minimal scaffold; manual synthetic dock `/m0-diff`, normalized keyboard/mouse selection, editor append, and cleanup.
- **Executed tests:** `npm run check` PASS (14 tests: 6 UI + 5 SDK stream + 3 SDK HTTP). No new PTY; human tests received via operator report, not simulated.
- **Human validated:** dock, mouse/ranges, functional/visual focus, and append without autosend in direct Pi and Herdr; H7 sidebar/split/zoom and H8 resize/reload/new/resume confirmed PASS by operator.
- **Corrected and revalidated:** theme visual accent indicator, without modifying editor; test and human confirmation PASS.
- **Extended lifecycle:** loopback HTTP 429→200, real bash abort, and SDK persistent restore PASS. Iteration contract documented, without confusing grouped queues with individual request.
- **Approved final decision:** ADR-003; user provisionally accepts individual unavailability of batched windows and joint diff differentiated from Last iteration. Without attribution guarantee. Literal drag DEFERRED to M3 without removing FR-16.
- **M0 closed:** final matrix and closing minutes in `M0.md`; feasibility and design not reopened.
- **M1 functional audit accepted:** 42/42 historical PASS. Subsequent mandatory correction: shared Linux/macOS/Windows engine implemented; cross-platform certification pending real CI. Local gate and particular guarantees at the end and in `M1.md`; no local PASS equals macOS/Windows/ubuntu-latest.
- **Stop:** without M2, definitive viewer, hunks, history, or drag/drop. No new Pi/Herdr human tests.

## 2. Documentary Deliverables (2026-10-22)

| File | Result | Validation |
|---|---|---|
| `RESEARCH.md` | Verified references, hypotheses, risks, and provisional decisions | Drafting completed; local tests NOT executed |
| `research/CLAUDE_CODE_DIFF.md` | Documentary research on Claude Code `/diff` system (`mods/diff`) | Drafting completed; verifiable sources and M1+ recommendations |
| `AGENTS.md` | Instructions, architecture, limits, future commands, DoD | Drafting completed; project commands DO NOT exist yet |
| `REQUIREMENTS.md` | FR/NFRs, BDD cases, roadmap, and gates | Drafting completed; acceptance pending |
| `PROGRESS.md` | Log and template for upcoming agents | Initial file created |

## 3. Roadmap — Real Status

| Milestone | Status | Evidence / Pending Criterion |
|---|---|---|
| M0 Feasibility | **CLOSED / PASS** | 14/14 PASS; H3/H7/H8 confirmed by operator; ADR-003 approved; pending product items explicitly deferred |
| M1 Snapshots | **CLOSED / PASS (CROSS-PLATFORM CI PASS)** | Run 40018853023 (commit 116b6a8): ubuntu 56/56, macos 55/56 (1 skip procfs), windows 54/56 (2 skips procfs + bash-abort); tsc + clean checkout. Engine and ADR-003 certified |
| M2 Viewer | **CLOSED / PASS** | Dock 45%, interactive resize, two-line inline explorer, unified hunks, compact header/footer (97/97 tests pass) |
| M3 Selection and Context | **CLOSED / PASS** | Keyboard/mouse selection, hunk selection, [path \| diff \| old:X \| new:Y] format, append with 'a' to native editor without auto-send (97/97 tests pass) |
| M4 Herdr/Robustness | **NOT STARTED** | e2e matrix + cleanup + performance |
| M5 Distribution | **NOT STARTED** | Installable package, README, CI, release |

## 4. Test Evidence and Verifications

### Envisioned Commands — Prior Initial Registration to Spike

Historical state; current results in M0 entry at end.

| Envisioned Command | Status | Reason |
|---|---|---|
| `npm run typecheck` | NOT RUN | Scaffold and `package.json` missing |
| `npm test` | NOT RUN | Test suite missing |
| `npm run check` | NOT RUN | Combined script missing |
| `pi --tui-mode fullscreen -e ./src/index.ts` | NOT RUN | Implementation and local Pi environment missing |

### Pending Manual Tests

- [ ] Pi fullscreen, without Herdr: right panel, editor, focus, and resize.
- [ ] Pi inside Herdr: mouse drag/select, independent scroll, editor, and pane resize.
- [ ] Pi inside Herdr: zoom, detach/reattach, and session restore.
- [ ] `/reload`, `/new`, `/resume`, `Ctrl+C`, panel close.
- [ ] Compatibility/collision with other extensions' `/diff` and `layoutRoot`.
- [ ] Baseline dirty, two requests, `bash` changes, and staging intact.
- [ ] Select multiple lines from different files, preserve draft, no autosend.
- [ ] Literal drag-and-drop to editor; log evidence if terminal/multiplexer prevents it.

## 5. Current Open Risks

| ID | Severity | Risk | Next Action |
|---|---|---|---|
| R-01 | High | Pi internal APIs for split may change | Spike and adapter isolation |
| R-02 | High | Herdr intercepts mouse/drag | Real test matrix |
| R-03 | High | Demarcation of one request vs multiple turns | Instrument lifecycle before engine |
| R-04 | High | Incomplete/costly filesystem captures | Design secure scope and measure |
| R-05 | Medium | Editor API may overwrite draft | Editor spike + tests |
| R-06 | Medium | Conflicts with `/diff`/layout extensions | Test joint load and fallback |

## 6. Concrete Plan of Next Agent (M0)

1. Read `AGENTS.md`, `REQUIREMENTS.md`, and `RESEARCH.md` completely; do not start with cosmetic UI.
2. Inspect environment and log versions: `node --version`, `npm --version`, `pi --version`, `herdr --version` (if installed); note terminal, operating system, TUI mode, and relevant extensions.
3. Confirm in real Pi availability/typing of events (`input`, `before_agent_start`, `agent_settled`, session) and secure method of writing to editor.
4. Implement minimum layout spike with **single owner**, clean close, and resize. Measure behavior with and without another extension using root.
5. Implement selection spike with mouse + keyboard and action of attaching snippet to editor **preserving** draft; repeat inside Herdr.
6. Test drag-and-drop from panel to editor; document real result and whether it requires new API or UX fallback.
7. Only then, decide final ADRs and create scaffold `package.json`, scripts, and first unit test; update M0 status.

**Do not create a complex snapshot architecture before demonstrating fundamental TUI capabilities.**

## 7. Mandatory Format for Future Entries

Upon finishing each development iteration, append at the end:

```markdown
### YYYY-MM-DD — Mx / brief description

**Changed**
- `path/to/file.ts`: concrete description

**Executed Tests**
| Command / case | Environment | Result | Evidence |
|---|---|---|---|
| `npm run check` | Node vX, OS Y | PASS/FAIL/BLOCKED/NOT RUN | relevant stdout / log file |

**Failures / limits / decisions**
- Exact risk or problem; do not hide regressions.

**Pending Test**
- Pending automated or manual case.

**Next Step**
- Only prioritized action of next milestone or current correction.
```

Do not replace historical evidence with general phrases like "tests OK." Do not claim PASS without real execution. Close each milestone when it meets its gate; do not continue refining unnecessarily.

### 2026-10-22 — M0 / first iteration: local APIs and synthetic dock

**Changed**
- `package.json`, lockfile, `tsconfig.json`, `.gitignore`: private scaffold, TS strict,
  typecheck/test/check scripts, pinned Pi/TUI 1.4.0; dev dependencies only.
- `src/index.ts`: experimental commands `/m0-diff`, `/m0-events`; does not register product
  `/diff` or `/iteration-diff` yet. Dock explicit only; bounded events in memory
  without prompts/code. TUI access via empty widget public factory and dispose.
- `src/ui/layout-adapter.ts`: single internal boundary for root/focus, composition with
  native root intact, rejection of unknown ownership, idempotent and conditional cleanup.
- `src/ui/feasibility-panel.ts`: three synthetic lines, keyboard/mouse range,
  explicit draft append, without send. Crossed release diagnostic only, not drop.
- `tests/feasibility.test.ts`: real TUI renderer with simulated terminal; five cases.
- `tests/pty-smoke.py`: installed CLI in temporary PTY/agent dir/workspace;
  without discovered extensions, credentials, model. Does not save real transcript.
- `M0.md`: commands, pending human steps, and limits. `RESEARCH.md`: public/internal
  API correction, lifecycle findings, and still conditioned ADRs.

**Environment**
- Local date 2026-10-22 (UTC-03); Linux 7.2.11-arch1-1; Node v26.12.0; npm 12.2.1.
- Installed Pi 1.4.0; Herdr 0.9.5; official Pi integration v9 `current`.
- Harness: `TERM=xterm-256color`, `TERM_PROGRAM=herdr`, bash stdin without TTY.
- Smoke: synthetic PTY 120×30, TERM xterm-256color, HERDR_* removed; NOT human
  terminal test or Herdr mouse transit. Suite uses viewport 120×24 and 45×24.

**Effectively Executed Tests**

| Command / case | Result | Evidence / Scope |
|---|---|---|
| `node --version`, `npm --version`, `pi --version`, `herdr --version` | PASS | Prior versions |
| `herdr integration status` | PASS | Pi v9 current; no integration modified |
| `pi --help` | PASS | Supports `--tui-mode fullscreen -e` and discovery isolation |
| `npm install --offline --ignore-scripts --no-audit --no-fund` | FAIL | ENOTCACHED: tsx 4.23.15 tarball missing |
| `npm install --ignore-scripts --no-audit --no-fund` | PASS | 123 packages; no lifecycle scripts; dev npm access only |
| First `npm run typecheck` | FAIL | Overload `pi.on` with union and callback narrowing; corrected with explicit logs and shared cleanup |
| Initial fake terminal diagnostics | FAIL | `drainInput` required by npm types; implemented async no-op |
| `npm run check` (three complete executions) | PASS | tsc without errors; 5/5 tests, 0 failures; last suite duration ≈382 ms |
| `python3 tests/pty-smoke.py` (three executions) | PASS | CLI starts without auto-opening, explicit visible dock, append reaches editor and renders draft, reload/close commands, exit 0 and mouse reset |
| SGR press/drag/release via real TUI | PASS | Range [0,2], release with negative x reaches panel; next press restarts selection; draft intact |
| Resize 120→45→120, keyboard/focus and Unicode columns | PASS | Panel hidden/restored, focus returns to editor; tabs expanded visually only, emoji/combining and column truncation |
| Foreign root, double mount, and conditional restore | PASS | Rejects incompatible root, does not step on subsequent owner; regular rejected with explicit error |
| SHA-256 npm vs real installation | PASS | tui-alt-screen/tui/h-stack/stack and interactive-mode/chat-viewport match; renderer hash in RESEARCH |
| `lens_diagnostics source=lsp scope=paths` (5 files) | PARTIAL | 0 diagnostics; 2 clean confirmed, 3 inconclusive by silent server. tsc is type evidence, not LSP cache |
| Architect prior to plan and final review of 6 files | PASS (review) | Demanded lifecycle, conditional ownership, and not equating selection/drop; final review without new blockers. Did not re-run tests |
| `git status --short`, `git diff`, `git diff --cached`, `git log -1` | PASS / limit | Repo without commits; original docs already untracked; empty index pre/post; no staging/commits |

**Mandatory Matrix Still Pending**

| Case | Status | Reason / Next Experiment |
|---|---|---|
| Pi common terminal, human interaction | BLOCKED in this harness | Bash without human TTY; automated PTY does not substitute visual/physical validation |
| Physical mouse inside Herdr, sidebar/split/zoom/detach/reattach | BLOCKED in this harness | Human client or Herdr test instance not exercised; installed binary does not prove compatibility |
| Runtime coexistence with official integration | NOT RUN | Full static read: does not touch layout; not loaded in isolated smoke |
| Scroll/wheel and physical selection; extreme height | NOT RUN | Suite covers width, not full manual matrix |
| `/new`, `/resume`, and layout extension coexistence | NOT RUN | Suite tests foreign root, not joint load or real session change |
| Real lifecycle write/edit/bash + queues/retry/abort | NOT RUN | Probe implemented and source inspected; controlled traces with authorized model missing |
| Literal drag/drop to editor | NOT RUN | Crossed release tested with synthetic SGR only; without hit-test/editor or physical evidence |
| Product `/diff` collision | NOT RUN | Spike registers `/m0-diff` only; product command final implementation in M2 |

**Failures / limits / decisions**
- M0 remains **partial**; all criteria not yet met and does not advance to M1.
- `before_agent_start` occurs after compaction and other handlers may have effects;
  baseline prior to all of them not guaranteed. Steering/follow-up require explicit contract.
- Editor not reimplemented, global installation/config, integration files,
  Herdr states, or Git index not touched. Dependencies use network only for dev installation.
- PTY verifies ANSI markers and command sending; does not interpret full screen,
  does not certify absence of artifacts or total reload semantics.
- Root recognition is specific to verified structure of Pi 1.4.0, not stable
  ownership API. Current safe fallback: warning and do not mount. Cursor/undo uncertified.
- No commit: repository without history with four original docs already untracked;
  prior user files not included nor mixed initial commit created.

**Next Step**
- Execute human matrix of `M0.md` in common terminal and test Herdr, and log
  `/m0-events` for controlled run with tools/queues/retry/abort. Resolve
  iteration contract and confirm ADR before closing M1. No snapshots/M1 yet.

### 2026-10-25 — M5 / real product screenshot for README

**Changed**
- `docs/assets/iteration-diff-demo.png`: authentic, unedited product screenshot of Pi inside Herdr (1920×1080) displaying the side-by-side dock with 4 files, expanded hunks, line numbers, active selection (`Sel: old:1-8, new:7-16 (10 lines)`), and appended diff excerpt in the native editor draft without modifying Git state.
- `README.md`: added image reference `![pi-iteration-diff demo](docs/assets/iteration-diff-demo.png)` below initial description.
- `docs/milestones/PROGRESS.md`: recorded screenshot artifact, test validation, and environment verification.

**Environment**
- Local date 2026-10-25 (UTC-03); Linux 7.2.11-arch1-1; Node v26.12.0; npm 12.2.1.
- Pi 1.4.0; Herdr 0.9.5; Hyprland 0.56.2; Kitty terminal (1920×1080 monitor, scale 1.2).

**Executed Tests**
| Command / case | Environment | Result | Evidence |
|---|---|---|---|
| `npm run check` | Node v26.12.0, Arch Linux | PASS | 151 tests pass, 0 fail; tsc clean (11.4s) |
| `test -f docs/assets/iteration-diff-demo.png` | Arch Linux | PASS | File exists; 1920×1080 PNG, 866 KiB |
| Real Pi inside Herdr session | Arch Linux / Herdr 0.9.5 | PASS | Live interactive execution in isolated demo workspace (`/home/agus-hy/Documentos/pi-diff-demo`), clean TUI fullscreen without third-party extensions, diff dock expanded with multiline selection and draft append |

**Failures / limits / decisions**
- Pi was launched with `--no-extensions --no-skills --no-mcp --no-context-files --no-prompt-templates` to eliminate visual noise from third-party plugins (ponytail, disambiguator, pi-lens linter warnings) and highlight core product functionality.
- Screenshot was captured authentically directly from Herdr without simulated mockups or image tampering.

**Pending Test**
- None for documentation and assets.

**Next Step**
- Continue with M5 release checklist or tag preparation.

