# pi-iteration-diff

Lightweight iteration diff viewer and selective prompt feedback extension for [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent).

Review net changes produced by the agent during the **last user request** in a right-hand dock beside the native chat and editor. Select lines or hunks and stage them into your draft prompt without automatic sending or losing in-progress text. Works in standard terminal emulators and inside **Herdr**.

---

## Features

- **Net Iteration Delta**: Shows only what changed during the completed turn, keeping uncommitted prior modifications separate.
- **Git Index Intact**: Never stages (`git add`), commits, or stashes your working tree.
- **Side-by-Side Dock**: Mounts seamlessly to the right of Pi's conversation and editor without altering their layout.
- **Keyboard & Mouse Navigation**: Full navigation via arrow keys, page up/down, file jumps (`[` / `]`), and mouse wheel / clicks.
- **Selective Feedback (`a`)**: Select individual lines or multi-line ranges and append formatted excerpts (`FIX` / `DISCUSS`) directly to the prompt editor without auto-sending.
- **Configurable Settings (`/diff-settings`)**:
  - `Auto-open after iteration`: Off by default; opt-in opens dock only upon completed individual iterations.
  - `Line numbers`: On / Off.
  - `File paths`: Smart / Full / Filename.
  - `Collapse files`: On / Off (defaults collapsed for fast overview).
  - `Dock width`: Adjustable between 30% and 60% (default 45%).
  - `Remember width`: Persists width globally across sessions in `<agent-dir>/iteration-diff.json`.
- **Cross-Platform**: First-class support on Linux, macOS, and native Windows.

---

## Installation

### Native Git Package (Recommended)

Install directly using Pi's built-in package manager:

```bash
pi install git:github.com/agmonetti/pi-iteration-diff
```

To pin to the v0.1.0 release candidate:

```bash
pi install git:github.com/agmonetti/pi-iteration-diff@v0.1.0
```

### Local Directory Installation

If you cloned or developed the extension locally:

```bash
pi install ./path/to/pi-iteration-diff
```

### Project-Local Installation

To install only for the current project (`.pi/settings.json`):

```bash
pi install git:github.com/agmonetti/pi-iteration-diff -l
```

### Ad-hoc / Development Invocation

To try the extension for a single session without writing to settings:

```bash
pi -e ./src/index.ts
# or using the package directory
pi -e ./path/to/pi-iteration-diff
```

---

## Usage

### Commands

| Command | Shortcut | Description |
|---|---|---|
| `/diff` | `F6` | Toggle the diff viewer dock. If open and unfocused, refocuses the dock. |
| `/diff-settings` | — | Open the interactive settings panel. |

### Keybindings in the Diff Dock

| Key | Action |
|---|---|
| `Up` / `Down` | Move cursor between diff lines and file headers. |
| `Shift+Up` / `Shift+Down` | Extend contiguous line selection range. |
| `Enter` / Click | Expand or collapse the selected file or hunk. |
| `a` | Append selected line(s) or hunk to native prompt draft as feedback. |
| `[` / `]` | Jump to previous / next file header. |
| `Left` / `Right` / `h` / `l` | Horizontal pan for long lines. |
| `Ctrl+Left` / `Ctrl+Right` | Shrink or widen the dock width (30% to 60%). |
| `d` | Toggle diagnostic and partial capture notices. |
| `Esc` | Return focus to the native editor without closing the dock. |
| `q` | Close the diff dock. |

---

## Configuration & Persistence

- **Global Width**: Stored at `<agent-dir>/iteration-diff.json` with permissions `0600`. When `Remember width` is `On`, manual resizing or drag adjustments are automatically saved and restored in future sessions and projects.
- **Session Settings**: Preferences toggled in `/diff-settings` (auto-open, line numbers, file path truncation, file collapse) are tracked per session and branch.

---

## Updating & Uninstallation

### Update

```bash
pi update git:github.com/agmonetti/pi-iteration-diff
# or update all installed packages:
pi update --extensions
```

### Uninstallation

```bash
pi remove git:github.com/agmonetti/pi-iteration-diff
# or for a local path install:
pi remove ./path/to/pi-iteration-diff
```

> **Note**: Removing the package cleanly unregisters it from Pi's settings. Your global preferences file (`<agent-dir>/iteration-diff.json`) is preserved safely and will be reused if you reinstall.

---

## Requirements & Compatibility

- **Pi Coding Agent**: version `1.4.0` or later.
- **Node.js**: version `22.x` or later (tested up to Node `26`).
- **Operating Systems**:
  - Linux (glibc, musl)
  - macOS (arm64, x64)
  - Windows 10/11 native (x64) and WSL
- **Herdr**: Fully compatible with Herdr panes, pane zoom, resize, and mouse routing.

---

## Known Limitations

- **Drag-to-Editor**: Terminal protocols vary in mouse drag-and-drop support across host emulators. Pressing `a` provides instant, deterministic staging to the prompt draft on all platforms.
- **External File Changes**: Files modified outside Pi or across concurrent sessions are recorded as observed deltas, not strictly guaranteed to have originated from the agent.
- **Host FS Contention**: Files deleted or modified by another process during snapshot capture are marked as partial to avoid falsely reporting deletions.

---

## License

[MIT](LICENSE) © 2026 Agustin Monetti
