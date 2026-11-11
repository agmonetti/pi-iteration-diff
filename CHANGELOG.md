# Changelog

All notable changes to `pi-iteration-diff` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Wrap long lines** (`/diff-settings` → `Wrap long lines`, default Off, persisted per branch like the other presentation settings): long diff rows expand into continuation rows instead of being truncated, breaking between words at whitespace — never mid-word (a token longer than the whole line, such as a long URL, still splits by columns). Continuation rows keep a blank line-number gutter and mark themselves with `│` under the `+`/`-` sign column; cursor, selection, and mouse targeting remain per logical line, and horizontal pan is inert while wrapping (every column is already visible). Turning it Off restores truncation (`»` overflow marker) and pan. Hunk and file headers always stay on one row.
- **Maximized full view** (`/diff-settings` → `Maximized full view`, default Off, persisted per user in `<agent-dir>/iteration-diff.json`): while the diff dock holds focus it occupies the entire Pi viewport (the full Pi pane inside Herdr); `Esc` dismisses the dock entirely and `F6` reopens it maximized (with the setting Off, `Esc` keeps the side dock and returns focus to the editor). With `Auto-open after iteration` also enabled, the auto-opened dock takes focus and fills the view immediately. Narrow terminals (below 90 columns) keep the existing fallback, and the stored dock width is never rewritten by maximized rendering.

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
