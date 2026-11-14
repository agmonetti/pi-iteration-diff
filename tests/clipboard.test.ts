import assert from "node:assert/strict";
import { test } from "node:test";
import { createClipboardWriter } from "../src/ui/clipboard.js";

test("host copySelection is preferred and only true counts as success", async () => {
  const calls: string[] = [];
  const writer = createClipboardWriter({
    copySelection: async (text: string) => { calls.push(text); return true; },
  }, { native: null, write: () => { throw new Error("must not reach OSC 52"); } });
  assert.equal(await writer("hola 🙂"), true);
  assert.deepEqual(calls, ["hola 🙂"]);
});

test("false and string results from the host clipboard are failures", async () => {
  const generic = createClipboardWriter({ copySelection: async () => false }, { native: null });
  assert.equal(await generic("x"), "Clipboard unavailable");
  const message = createClipboardWriter({ copySelection: async () => "denied by desktop" }, { native: null });
  assert.equal(await message("x"), "denied by desktop");
});

test("a rejected host copy is reported without throwing", async () => {
  const writer = createClipboardWriter({
    copySelection: async () => { throw new Error("no clipboard"); },
  }, { native: null });
  assert.equal(await writer("x"), "no clipboard");
});

test("the native helper is used when the host injects no copySelection", async () => {
  let copied: string | undefined;
  const writer = createClipboardWriter({}, {
    native: { setText: async text => { copied = text; } },
  });
  assert.equal(await writer("línea"), true);
  assert.equal(copied, "línea");
});

test("a failed native helper falls back to honest unverified OSC 52", async () => {
  const sequences: string[] = [];
  const writer = createClipboardWriter({}, {
    native: { setText: async () => { throw new Error("closed"); } },
    write: sequence => { sequences.push(sequence); return true; },
  });
  assert.equal(await writer("café 🙂"), "Copy sent via OSC 52; terminal clipboard support is unverified");
  assert.deepEqual(sequences, [`\x1b]52;c;${Buffer.from("café 🙂").toString("base64")}\x07`]);
});

test("OSC 52 refuses an oversized payload and reports a failed write", async () => {
  let writes = 0;
  const writer = createClipboardWriter({}, { native: null, write: () => { writes++; return true; } });
  assert.equal(await writer("a".repeat(75_001)), "Clipboard unavailable: text exceeds the OSC 52 size limit");
  assert.equal(writes, 0);
  const failing = createClipboardWriter({}, { native: null, write: () => false });
  assert.equal(await failing("x"), "Clipboard unavailable: could not write to the terminal");
});

test("empty text is never sent to a clipboard", async () => {
  let called = false;
  const writer = createClipboardWriter({
    copySelection: async () => { called = true; return true; },
  }, { native: null });
  assert.equal(await writer(""), "Nothing to copy");
  assert.equal(called, false);
});
