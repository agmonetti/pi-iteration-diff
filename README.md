# pi-iteration-diff

A diff viewer extension for [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent) that shows the net changes from the last completed request in a side dock. Select lines and send them back as feedback — without touching Git or your draft.

<!--
Screenshot placeholder — replace with an actual capture of the dock
alongside Pi's conversation pane once the extension is published.
-->

## Install

```bash
pi install git:github.com/agmonetti/pi-iteration-diff
```

Project-local only: add `-l`.

## Features

- **Net delta only** — isolates what changed in the last request from prior uncommitted work.
- **Git-safe** — never stages, commits, or stashes.
- **Side dock** — mounts to the right of Pi's editor; resizable, persistent width.
- **Keyboard & mouse** — full navigation, file jumps, horizontal pan, and multi-line selection.
- **Selective feedback** — append lines to the prompt draft as `FIX` / `DISCUSS` excerpts without auto-sending.
- **Herdr compatible** — works in standard terminals and inside Herdr panes.

## Usage

| Action | Command / Key |
|---|---|
| Toggle dock | `/diff` or `F6` |
| Settings | `/diff-settings` |
| Navigate lines | `Up` / `Down` |
| Select range | `Shift+Up` / `Shift+Down` |
| Jump between files | `[` / `]` |
| Expand / collapse file | `Enter` or click |
| Append to prompt | `a` |
| Resize dock | `Ctrl+Left` / `Ctrl+Right` |
| Focus back to editor | `Esc` |
| Close dock | `q` |

## Configuration

Available via `/diff-settings`:

| Setting | Default | Description |
|---|---|---|
| Auto-open after iteration | Off | Open dock automatically when a request completes |
| Line numbers | On | Show line numbers in diff |
| File paths | Smart | `Smart` / `Full` / `Filename` |
| Collapse files | On | Start with files collapsed |
| Dock width | 45% | Adjustable 30–60% |
| Remember width | On | Persist width across sessions |

## Compatibility

- **Pi** ≥ 1.4.0, **Node** ≥ 22
- Linux, macOS, Windows native
- Herdr panes, resize, and mouse routing

## Limitations

- Terminal drag-to-editor support varies by emulator; press `a` as the reliable alternative.
- Files modified outside Pi during a session are recorded as observed deltas, not guaranteed agent-authored.
- Files deleted by another process mid-capture are marked partial.

## License

[MIT](LICENSE)
