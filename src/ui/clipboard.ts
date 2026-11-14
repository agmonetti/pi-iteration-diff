import { getNativeClipboard } from "@earendil-works/pi-tui";

/**
 * Pi's fullscreen TUI carries the host's clipboard implementation as a runtime
 * option (`copySelection`), but the installed pi-tui 1.4.0 .d.ts keeps that
 * field private. Keep that internal access here, version-pinned, with
 * capability detection and an honest fallback; never surface raw terminal data.
 */
interface ClipboardTui {
  copySelection?: (text: string) => Promise<boolean | string>;
  terminal?: { write(data: string): void };
}

export interface ClipboardOptions {
  /** Override the native helper (tests); `null` disables it. */
  native?: { setText?(text: string): Promise<void> } | null;
  /** Override the OSC 52 sink (tests). Return false when the write fails. */
  write?: (sequence: string) => boolean;
}

export type CopyText = (text: string) => Promise<true | string>;

/** Same ceiling Pi applies to an OSC 52 payload (base64 characters). */
const MAX_OSC52_ENCODED_LENGTH = 100_000;

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : "Clipboard unavailable";
}

function writeOsc52(text: string, tui: ClipboardTui, override?: (sequence: string) => boolean): true | string {
  // Refuse before allocating the base64 payload.
  if (Math.ceil(Buffer.byteLength(text, "utf8") / 3) * 4 > MAX_OSC52_ENCODED_LENGTH) {
    return "Clipboard unavailable: text exceeds the OSC 52 size limit";
  }
  const encoded = Buffer.from(text, "utf8").toString("base64");
  const sequence = `\x1b]52;c;${encoded}\x07`;
  try {
    if (override) return override(sequence) ? true : "Clipboard unavailable: could not write to the terminal";
    if (tui.terminal && typeof tui.terminal.write === "function") {
      tui.terminal.write(sequence);
      return true;
    }
    process.stdout.write(sequence);
    return true;
  } catch {
    return "Clipboard unavailable: could not write to the terminal";
  }
}

/**
 * Build a clipboard writer for the TUI that owns the dock. Resolution order:
 *
 * 1. The host's injected `copySelection` (Pi fullscreen). It already knows the
 *    platform clipboard, command-line tools, and OSC 52, and reports real
 *    failures, so its `false`/message results are never overridden here.
 * 2. The native clipboard helper where the platform package exposes `setText`.
 * 3. A direct OSC 52 write. `terminal.write` cannot confirm delivery, so it is
 *    reported as a warning-worthy "sent, unverified" result, never as success.
 *
 * The copied text is never logged or persisted.
 */
export function createClipboardWriter(tui: unknown, options: ClipboardOptions = {}): CopyText {
  const candidate = (tui ?? {}) as ClipboardTui;
  return async (text: string): Promise<true | string> => {
    if (text.length === 0) return "Nothing to copy";
    if (typeof candidate.copySelection === "function") {
      try {
        const result = await candidate.copySelection(text);
        if (result === true) return true;
        if (typeof result === "string" && result.trim()) return result.trim();
      } catch (error) {
        return errorMessage(error);
      }
      return "Clipboard unavailable";
    }

    const native = options.native === undefined ? getNativeClipboard() : options.native;
    if (native?.setText) {
      try {
        await native.setText(text);
        return true;
      } catch {
        // Fall through to the terminal route below.
      }
    }
    const written = writeOsc52(text, candidate, options.write);
    if (written !== true) return written;
    return "Copy sent via OSC 52; terminal clipboard support is unverified";
  };
}
