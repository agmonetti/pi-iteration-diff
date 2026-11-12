# Changelog

All notable changes to `pi-iteration-diff` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-11-12

### Added

- **Auto-close dock on user message**: When the diff dock is open in split mode, submitting a new message in Pi immediately dismisses the dock (`pi.on("input")`), returning full terminal width to the conversation and editor during the run.
- **Per-user persistence for Wrap long lines**: The `Wrap long lines` preference is now persisted per user across sessions and workspaces in `<agent-dir>/iteration-diff.json`, matching the behavior of `Auto-open after iteration` and `Maximized full view`.

### Fixed

- **Empty-state presentation in diff viewer**: Reviewing an iteration with zero net changes now presents a clean, compact notice (`No net changes observed in this iteration.`) instead of a full screen of routine technical notices (viewer limits, net snapshot disclaimers, omitted path counts). Technical details remain available on demand via `d`.

## [0.1.1] - 2026-11-11

### Added

- **Maximized full view** (`/diff-settings` → `Maximized full view`, default Off, persisted per user in `<agent-dir>/iteration-diff.json`). While the diff dock holds keyboard focus (F6 or a click on it), it occupies the entire Pi viewport instead of the configured dock width. In maximized mode `Esc` dismisses the dock entirely, leaving only Pi's conversation and editor, and `F6` reopens it maximized; with the setting Off, `Esc` keeps the side dock open and returns focus to the editor. With `Auto-open after iteration` also enabled, the auto-opened dock takes focus and fills the view immediately. Narrow terminals (below 90 columns) keep the existing layout fallback, and maximized rendering never rewrites the stored dock width. Inside Herdr the ceiling is the Pi pane; Herdr's own zoom covers the rest of the window.
- **Wrap long lines** (`/diff-settings` → `Wrap long lines`, default Off, persisted per branch). Long diff rows expand into continuation rows instead of being truncated. Breaks fall between words at whitespace, never mid-word; a single token wider than the whole line, such as a long URL, splits by columns so no content is lost. Continuation rows keep the line-number gutter blank and carry a `│` marker under the `+`/`-` sign column. Cursor navigation, selection, page keys, and mouse targeting remain per logical line, so interacting with any continuation selects the whole row. While wrapping is On, horizontal pan is inert because every column is already visible; turning the option Off restores truncation and pan. Hunk and file headers always remain single rows.

### Fixed

- The dock's width is now computed at layout time from live focus and viewport state, not at render time. Previously, after a focus change, the layout used a stale basis: the native column hid while the dock stayed narrow with dead space to the right.
- An auto-opened dock now takes focus and fills the view immediately when `Maximized full view` is enabled, instead of opening unfocused at the stored width.

## [0.1.0] - 2026-10-25

### Added
- **M0 Feasibility & TUI Architecture**:
  - Side-by-side dock integration using Pi's `layoutRoot` adapter.
  - Safe lifecycle coordination intercepting user input, agent turns, and settlement without hijacking native editor or conversation.
  - PTY smoke harness verifying clean startup, mouse handling, and tear-down.
- **M1 Net Iteration Snapshots**:
  - Safe before/after workspace capture without touching the Git index, creating commits, or stash entries.
  - Shared cross-platform identity checks preventing symlink traversals, path escape, and race condition false deletions.
  - Memory and size caps with honest partial capture reporting.
  - Multiplatform CI matrix on Linux, macOS, and Windows native.
- **M2 Collapsible Diff Viewer & Explorer**:
  - Two-line file header with basename, relative path, status indicator, and net line stats.
  - Per-file collapse/expand and hunk navigation.
  - Keyboard and mouse scrolling, responsive narrow fallback, and Unicode-aware column metrics.
- **M3 Context Selection & Feedback Staging**:
  - Contiguous line range and hunk selection via keyboard (`Shift+Up` / `Shift+Down`) and mouse.
  - Append to prompt draft (`a`) with structured excerpt (`path`, `line range`, `code`) and intent options (`FIX` / `DISCUSS`) without auto-sending.
  - Separator drag and keyboard dock resizing with ratio preservation (30%–60%).
- **M3.5 Settings & Command Refinement**:
  - Dedicated `/diff-settings` command for in-place configuration.
  - Six granular preferences: Auto-open after iteration (default Off), Line numbers, File paths, Collapse files, Dock width, Remember width.
  - Clean `/diff` command and `F6` shortcut without legacy aliases.
- **M4 Robustness & Cross-Platform Persistence**:
  - Global persistence of dock width and `Remember width` in `<agent-dir>/iteration-diff.json` (mode 0600) with safe atomic writes.
  - Safe fallback for missing, corrupted, or inaccessible global configuration.
  - Focus restoration to editor upon dock closure, `Esc`, and native transcript interactions.
- **M5 Autonomous Packaging & Distribution**:
  - Official Pi package manifest in `package.json` with `pi.extensions` and `pi-package` keywords.
  - Zero external runtime dependencies; proper declaration of host-provided peers (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`).
  - Distribution tarball isolation packaging only `src/`, `README.md`, `LICENSE`, and `package.json`.
  - Comprehensive automated package installation, update, uninstallation, and multi-project test suite.
  - Native package discovery validated in PTY without `-e`.
