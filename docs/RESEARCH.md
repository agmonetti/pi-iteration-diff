# RESEARCH.md — Technical Research and References

**Provisional Project:** `pi-iteration-diff`
**Research Date:** 2026-10-22
**Initial Status:** documentary research. **Current Status:** M0 closed; M1 functional audit accepted; portability mandatory correction in progress, cross-platform CI certification pending. ADR-003 in force, UI frozen and M2 unstarted. M0 minutes and M1 decisions at the end.
**Objective:** diff panel to the right of Pi's conversation, manually invoked, with line/range selection and sending to Pi's native editor; compatible with Pi executed inside Herdr.

> This research is context for decisions, **not proof of compatibility** with the user's installed versions. Contrast APIs, versions, and source code before implementing. Separate verified observations from hypotheses.

## 1. Main Sources (Consultation Order)

1. **Pi — Extensions and Lifecycle:** https://pi.dev/docs/latest/extensions
2. **Pi — TUI, Components, and Mouse:** https://pi.dev/docs/latest/tui
3. **Claude Code — `/diff` / panel:** https://code.claude.com/docs/en/interactive-mode#review-changes-with-diff
4. **pi-split-view:** https://github.com/Hugo-W/pi-split-view
   - Layout manager: https://github.com/Hugo-W/pi-split-view/blob/main/layout-manager.ts
   - Extension: https://github.com/Hugo-W/pi-split-view/blob/main/split-view.ts
5. **pi-slopchop:** https://github.com/robzolkos/pi-slopchop
6. **Herdr — Integrations:** https://herdr.dev/docs/integrations/
7. **Herdr — Plugins:** https://herdr.dev/docs/plugins/
8. **Herdr — Configuration:** https://herdr.dev/docs/configuration/
9. **Herdr — Agents:** https://herdr.dev/docs/agents/

References are dated; interfaces may change. Save consulted versions/commits during M0.

## 2. Benchmark: Claude Code `/diff`

**Confirmed by official documentation (2026-10-22):**

- In fullscreen, `/diff` opens a panel alongside conversation; in classic renderer a dialog is used.
- The panel lists files and line counts, allowing navigation and viewing each file's diff.
- There is a `source` selector: `Current` (working tree) and `T1`, `T2`, etc. (per-request change views).
- The `ask` button appends a file's diff to the next prompt.
- The panel can remain open and refresh upon editing or running commands.
- `cc-plugin-diff` is the documented integrated implementation; fullscreen panel requires Git, sufficiently wide terminal, and compatible version.
- **Important:** documentation states Claude's panel *may open automatically*. Our project MUST NOT copy this behavior: opening must be exclusively manual.
- **Important:** Claude's `T1/T2` are derived from editing tools; changes via shell may appear only in `Current`. Our goal is to capture iteration net changes even if originating from shell commands.
- **Unverified:** literal drag-and-drop of a snippet from diff to editor. Official documentation describes `ask` per file; do not attribute range selection or drag as confirmed fact.

**What we take:** visible conversation, persistent panel, selectable sources, navigation, action to append to prompt. **What we improve:** range selection, multiple selections, per-request diffs independent of Git HEAD, manual opening.

## 3. `pi-split-view`: TUI Composition Reference

**Repository:** https://github.com/Hugo-W/pi-split-view

**Verified observations:**

- Exposes `/files` to show/hide a right dock in Pi fullscreen, and an overlay alternative in regular mode.
- Its panel displays files and a preview of recent edits; it is not a complete per-request change history.
- Uses `@earendil-works/pi-tui` components and preserves Pi's original TUI as part of composition.
- `layout-manager.ts` reads `tui.layoutRoot`, invokes `tui.setLayoutRoot(...)`, and rebuilds layers over a base root. After `/reload` it attempts to restore old compositions; uses full repaint to avoid artifacts.
- README warns of incompatibility with other extensions separately controlling the fullscreen root; **a single root owner is a design restriction**.
- Handles panel resizing and considers real visible width, Unicode, and lifecycles.

**Consequence:** provides documentary proof that a side split is viable, but composition over `layoutRoot` is an internal/fragile dependency and deserves a compatibility *spike*. Do not copy code entirely; extract concepts and respect MIT license if code is incorporated.

## Questions M0 must resolve:

- Is there a current Pi public API allowing side composition without manipulating the root?
- What happens if `pi-split-view` and our extension are loaded together? Is there a supported way to share the layout manager? If not, detect conflict and degrade clearly, without stepping on layers.
- Are editor, focus, shortcuts, themes, scroll, and view preserved after `/reload`, session close, and resize?

## 4. `pi-slopchop`: Diff and Feedback Reference

**Repository:** https://github.com/robzolkos/pi-slopchop

**Confirmed by README:**

- Exposes `/slopchop` and `/diff`, a manual review workflow inside Pi.
- Has scopes `git diff`, `last commit`, and `all files`; **does not define a complete before/after snapshot of each user request as default source**.
- Navigation between files/hunks, unified and side-by-side view.
- Annotations on added and deleted lines, multiline ranges on one side of diff, per-file and global comments.
- Two feedback intents: `FIX` (change) and `DISCUSS` (explain/debate).
- Generates a prompt in the editor and **does not send it automatically**.

**How to leverage it:** study its parser/structured model, side and line number identification, selection, annotations, and feedback serialization. Avoid copying review screen UX over conversation: requirement is a **side panel**.

**To verify in code before adopting:** exact dependency on diff engine, mouse handling, previous draft handling, and exact semantics of editor API. Do not assume existing text is preserved. Do not copy third-party implementations without reviewing license, attribution, and versions.

## 5. Pi: Lifecycle and Editor Integration

**Official documentation:** https://pi.dev/docs/latest/extensions

- Extensions are TypeScript modules loaded in Pi's process and can register slash commands and events.
- `turn_end` corresponds to a **model turn**, not necessarily a user request.
- `agent_end` may precede recovery, retry, or queued work; **do not take it as definitive finish**.
- `agent_settled` occurs when automatic continuation exhausts; useful reference to anchor final capture.
- `input`, `before_agent_start`, `session_start`, `session_shutdown`, etc., allow modeling capture lifecycle, but their exact payloads must be studied.
- A user request can generate multiple model turns and tool executions.

**Proposed decision (to validate):**

1. Capture a baseline **before** any tool or side effect of request.
2. Maintain logical unit of **iteration = user request and associated work**; separate another explicit request or record ambiguity if runtime groups queues/continuations.
3. Capture after `agent_settled`, handling cancellations, crashes, concurrent calls, and session changes.
4. Compute net diff `after - before` on file contents. Tool events only as auxiliary signals, never sole source.

**Open point:** determine whether `before_agent_start` ensures baseline before absolutely all run changes in recent versions, how queued messages are resolved, and how snapshots are preserved upon extension reload. Document evidence in M0.

## 6. Pi TUI: Mouse Events and Rendering Mode

**Official documentation:** https://pi.dev/docs/latest/tui

- `@earendil-works/pi-tui` has composition (`HStack`, `VStack`, `ScrollView`, etc.), focus handling, components, and terminal visible width utilities.
- In **fullscreen**, normalized mouse events are delivered and a drag sequence can be captured.
- In **regular mode**, mouse belongs to terminal and its scrollback; every operation must have keyboard alternative.
- `ctx.ui.custom()` serves for temporary screen/overlay; not equivalent to persistent split beside editor.
- Do not rebuild Pi editor or create another terminal renderer.

**Risk:** capturing drag inside diff is not the same as being able to transport it to editor in another region. Requires prototype with drag terminator, coordinates, focus, and copy/selection handling by multiplexer.

## 7. Herdr: How It Actually Fits

**Confirmed by official documentation:**

- Herdr manages workspaces, tabs, panes, terminals, and agent state/session. Pi remains owning process of its conversation and editor.
- `herdr integration install pi` installs `herdr-agent-state.ts` in Pi's extension directory (respects `PI_CODING_AGENT_DIR`).
- That integration reports state and data for session restoration; **do not replace, modify, or duplicate** that bridge.
- Its plugin API offers commands, events, and terminal panes; plugin documentation indicates no arbitrary v1 plugin native UI.
- Herdr modifies effective app width when reserving sidebar and splitting panes. Focusing, maximizing, attaching clients, or reconnecting can change dimensions.

**Recommended decision:** extension installed in Pi, working identically in normal terminal and inside Herdr. Herdr is host platform and optional integration layer; do not create separate Herdr process/plugin as MVP requirement.

**Mandatory validation in Herdr:**

- Mouse down/drag/up inside diff vs. Herdr text selection.
- Focus between panel and editor; scroll of each region.
- Pane resize, pane zoom, additional split, sidebar, detach/reattach, restore.
- Coexistence with official integration `herdr-agent-state.ts`.
- If adding "review ready" state to sidebar: do it only in separate milestone without replacing `idle/working/blocked`.

## 8. Snapshot vs. Git diff

Classic failure example:

- Before request: `config.ts` has uncommitted user changes.
- Request A: Pi modifies `auth.ts`.
- Request B: Pi modifies `users.ts`.
- Desired result for `/diff` after B: **only B's delta**, independent of prior changes.
- `git diff HEAD` mixes those changes and **does not satisfy** requirement.

**Recommended model:** one baseline per iteration and final state; net comparison of eligible files. Present result as "changes observed in this period", **not unequivocal forensic attribution to Pi**: other processes may write simultaneously.

**Problems to resolve before fixing backend:**

- Enumeration and exclusions (`.gitignore`, configurable glob, hidden files, untracked, outside-repo files).
- Atomic write, new/deleted files, renames, binaries, permissions, symlinks, and huge files.
- Gigantic directories; incremental capture/write observation vs. total snapshot. Avoid scanning entire repo indiscriminately every turn.
- Filtering secrets and generated artifacts; memory/I/O limits; cleanup and sensitive data.
- Submodules and Git worktrees; cwd/repo changes mid-process.
- Simultaneous sessions in different worktrees and concurrent changes.
- Persistence after `/reload` and restoration: goal of later phases, no data leak by default.

**Do not prefer `git add`, `git stash`, `git commit`, or real index manipulation.** Temporary index is researchable alternative, but must specify if creating objects in `.git/objects`. For MVP evaluate ephemeral snapshots outside repository and limit scope.

### Text-only omission clarification (2026-10-28)

Binary and invalid UTF-8 content, detected only after the existing bounded and identity-validated read, remain explicit `binary-or-encoding` omissions but no longer add a capture issue. Completeness describes eligible text, not binary review. This prevents unchanged image assets from blocking opt-in auto-open. Unknown endpoints in text/binary transitions still produce partial deltas; read, identity, cancellation and limit failures remain issues.

### Dotfiles auto-open follow-up (2026-10-28)

Metadata-only inspection of `~/Documentos/dotfiles` identified 12 PNG files above the 1 MiB per-file limit (10 under `assets/wallpapers/`, two under `yazi/.config/yazi/flavors/`) and two internal relative symlinks (`kitty/.config/kitty/themes/active.conf` and `micro/.config/micro/colorschemes/kitty-sync.micro`). A bounded PNG signature probe now occurs only after safe open and descriptor/path/parent checks, with post-probe verification; any other oversized file still raises `file-size-limit`. Internal relative symlinks are eligible for omission only if their target is independently captured as text in the same snapshot; link metadata/parents are checked without following the link. Retargeted, created or removed links yield `unknown-endpoint` at comparison; external links, uncaptured targets, hardlinks and special files still raise `unsupported-file-type`. This is a content-review scope decision, not symlink diff support or an authorship guarantee. It does not prove the live Pi/Herdr iteration auto-opens; that requires a consented installed-extension update and manual run.

## 9. Provisional ADRs

- **ADR-001 — Runtime:** TypeScript as Pi extension; no Electron/WebView or new resident process. Provisional.
- **ADR-002 — UI:** side dock inside Pi fullscreen. Fallback without mouse in regular mode. Conditioned on layout spike.
- **ADR-003 — Source:** "last completed user iteration" by default; secondary Git Current and opt-in for comparisons. Conditioned on capture test.
- **ADR-004 — Editor:** feedback staging and explicit application to editor without overwriting drafts; never auto-send.
- **ADR-005 — Herdr:** not a hard dependency. Compatibility and end-to-end tests prioritized.
- **ADR-006 — Layout Control:** if another extension has incompatible ownership, do not force root; report conflict and use fallback if available.

## 10. Prioritized Risks and Open Questions

| Priority | Question | How to Resolve |
|---|---|---|
| P0 | Can a dock be inserted without breaking editor or other extensions? | Fullscreen spike in real Pi; `/reload`, resize, and cleanup |
| P0 | Does line/range drag work inside Herdr? | Mouse + keyboard test matrix with Pi/Herdr installed |
| P0 | What is correct hook for baseline/final? | Event test with prompt doing `write`, `edit`, `bash`, and multiple rounds |
| P0 | How to append snippets without losing draft? | Editor API and focus test; no auto-send |
| P1 | How to scale snapshots without scanning millions of files? | Benchmarks with large repo + incremental strategy |
| P1 | Does it coexist with `pi-split-view`/`pi-slopchop`? | Test `/diff` collision and layout in isolated instance |
| P1 | How to express binary/rename diffs? | Fixtures and proper messages |
| P2 | Persist state between `/reload` and sessions? | Secure, opt-in, and bounded storage design |

## 11. What Has NOT Been Proven

- No extension has been tested on user's local installation.
- Pi, Herdr, terminal, and installed extension versions not validated.
- Literal drag-and-drop from diff to editor not guaranteed achievable under all multiplexers.
- No snapshot algorithm implemented yet, nor performance benchmark.

Original next action was **M0 — feasibility spikes**. Local log follows; prior historical claims do not substitute these tests.

## 12. Local M0 — Pi 1.4.0 / Herdr 0.9.5 (2026-10-22)

### Verified APIs in Installation and npm Package

- Read full README, `docs/extensions.md`, `docs/tui.md` from installation,
  example `widget-placement.ts`, declarations and relevant runtime bodies.
- `ExtensionUIContext` offers no dock method. Offers widgets above/below
  editor, temporary custom, and factories. Empty widget allows getting TUI without
  replacing editor/header/footer; its `dispose` allows cleanup.
- **Correction of prior hypothesis:** `isViewportTUI` and `ViewportTUI.setLayoutRoot`
  are exported/typed publicly. `layoutRoot` and `getFocusedComponent` are not
  in public TUI contract. Only those internal accesses live in adapter.
- Pi already installs native root from `createChatViewport`. Cannot assume
  `layoutRoot === undefined`, nor reconstruct chat with `tui.children` and automatically
  preserve scroll/editor. Spike wraps original root intact.
- HStack/VStack/ScrollView manage layout and coordinates. Mouse capture returns
  drag/release events to original component, with local coordinates outside its
  bounds. Automated SGR test confirms crossed release; DOES NOT prove physical mouse
  nor hit-testing/drop on editor.
- `getEditorText`/`setEditorText` allow sync read+append without autosend. Tested
  literal content and two appends in suite; PTY CLI confirms arrival at native editor.
  Does not claim cursor/undo preservation.

### Lifecycle: Findings and Limit

`dist/core/agent-session.js:_prepareRun` executes compaction check **before**
`emitBeforeAgentStart`. Latter precedes run model/tools, not all
possible effects of other handlers/extensions. `_handlePostAgentRun` can
continue via queues/retry; `_runBeforeSettleBoundary` can request continuation.
`_emitAgentSettled` is automatic close, not `turn_end` or `agent_end`.

Probe `/m0-events` records only names/sources/message type/tool names
(aborted at settled), in memory, max 100. Still no trace of real run with
write/edit/bash, queues, retry, and cancellation. Iteration contract not yet confirmed:
especially steering/follow-up and prior handlers with effects.

### Herdr and Decisions

`herdr --version` = 0.9.5; official Pi integration v9 lists `current`. Read full
`herdr-agent-state.ts`: observes sessions/agent_start/agent_settled and `herdr:blocked`;
does not control layout or mouse. Our spike does not publish Herdr states or modify that
file. This is static review, **not** an approved e2e matrix.

ADR-001 confirmed for this spike (TypeScript extension). ADR-002/006 have partial
automated evidence: manual dock, rejection of foreign root, and conditional restore;
lacks human matrix. ADR-003 still conditioned on lifecycle. ADR-004 confirmed only for
explicit synthetic append; real old/new selection pending M3. ASF-005 maintained,
but Herdr compatibility remains uncertified. No third-party code adopted.

Renderer `tui-alt-screen.js` npm and installed matches SHA-256
`ea5f52dc983f60c4354c674bd19f0d296fda8b5fa86185d4a4bdf0343b1ff92b`;
also matching `tui.js`, `h-stack.js`, `stack.js`, `interactive-mode.js`, and
`chat-viewport.js`. Versions, results, blockages, and next gate in `milestones/PROGRESS.md`;
reproducible steps in `milestones/M0.md`. M0 remains open and does not enable M1.

### M0 Continuation (2026-10-22): Evidence Limits and Protocol

- Reconfirmed Pi 1.4.0, Node v26.12.0, npm 12.2.1, Herdr 0.9.5, and official Pi
  integration v9 current. Bash returns `NO_TTY`; TERM/TERM_PROGRAM do not prove physical interaction.
  Active pane was not manipulated, nor integrations installed.
- `npm run check` (5/5) and `python3 tests/pty-smoke.py` pass again. Automated evidence
  of spike, NOT model traces or Herdr manual validation.
- `milestones/M0.md` now separates eight human cases and six lifecycle cases, with inputs,
  environment, expected result, and limits. All remain pending, unapproved.
- **Drag/drop:** spike does not implement hit-testing or transfer upon release over
  editor. Release outside panel does not prove terminal impossibility.
  Furthermore, drag changes cursor per local coordinate vertical: do not assume
  original range is preserved when crossing regions. Alternative `a` requires verifying
  effective selection. FR-16 remains open, without approved exception.
- **Lifecycle:** buffer of 100 names does not distinguish steering/follow-up consumption,
  provider retry, or session correlation; cleared on session start/close.
  Not enough to certify contract. Do not claim `input.source` distinguishes queue
  type. For reproducible retry, controlled local provider needed (429→success);
  tool failure or manual retry are not substitutes. For resume, isolated persistent
  session required, not `--no-session` used by UI test.
- **Decision:** ADR-002/003/005/006 not elevated to confirmed compatibility. Maintain
  M0 open; no snapshot/M1 implementation. Next work: human execution H1–H8 and fixture/traces L1–L6, before fixing iteration boundaries.

### Additional SDK Evidence (2026-10-22)

`tests/lifecycle.test.ts` executed against real Pi 1.4.0 AgentSession/Agent,
with public `agent.streamFunction` replaced by local stream, without network. Real
write/edit/bash tools in private mkdtemp: four turn_end and one agent_settled.
Queued steering/follow-up arrive in second request; both cases end
with a single settled. Therefore, a settled boundary can group several explicit
entries: **not necessarily equivalent to an individual request**. ADR-003 remains
open; before M1 resolve separation or grouped capture warning, without
attributing individual snapshots where runtime exposes no isolated boundary.

Normalized retry `429 rate limit exceeded` produces agent_end, auto_retry_start,
new agent_start, auto_retry_end, and only then settled false. Stream abort
produces settled true; new subsequent request settled false. Runtime assertions,
not fabricated event list or HTTP transport test. Tool abort, HTTP retry,
and persistent restore missing. Metadata logged without prompts/code; fixture removes files and disposes session in finally.

Drag: current implementation does not hit-test/drop to editor. No evidence
to declare Pi/Herdr protocol generally impossible or unreliable. Crossed capture
and local coordinates are concrete risk: dragging outside can
change range. Keep literal drag as NOT IMPLEMENTED / human validation
NOT RUN. Alternative proposed and already present in spike: select inside
panel → `a` appends to editor explicitly, preserving draft, without sending.
Does not equal FR-16 or constitute approved exception. Human commands for Pi
and named Herdr session, with explicit official integration, are in milestones/M0.md.

Automated result of this continuation: `npm run check` PASS 10/10. No new
PTY, no human tests; Herdr compatibility uncertified. M0 remains open.

### Pi + Herdr Human Evidence and Focus (Report received 2026-10-22)

Operator reports Arch Linux, Pi 1.4.0, and Herdr 0.9.5; tested direct Pi and real
Herdr pane with spike and official integration loaded. H1/H2/H4/H6 PASS on both:
right dock, mouse selection, focus toggling, and explicit append without autosend.
Client terminal, dimensions, and execution time not reported (details in milestones/M0.md).
