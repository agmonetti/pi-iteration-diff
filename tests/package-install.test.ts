import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { loadDockWidth, saveDockWidth } from "../src/ui/dock-width-store.js";

import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const PI_CLI = resolve(ROOT, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");

function runPi(args: string[], env: NodeJS.ProcessEnv, cwd = ROOT) {
  return spawnSync(process.execPath, [PI_CLI, ...args], {
    cwd,
    env: { ...process.env, ...env, PI_OFFLINE: "1", PI_TELEMETRY: "0" },
    encoding: "utf8",
  });
}

test("package manifest conforms to official Pi packaging conventions", () => {
  const pkgPath = join(ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

  assert.equal(pkg.name, "pi-iteration-diff");
  assert.equal(pkg.version, "0.1.0");
  assert.equal(pkg.type, "module");
  assert.equal(pkg.main, "src/index.ts");
  assert.deepEqual(pkg.pi?.extensions, ["./src/index.ts"]);
  assert.ok(Array.isArray(pkg.keywords) && pkg.keywords.includes("pi-package"));
  assert.equal(pkg.license, "MIT");

  // Host-provided packages must be in peerDependencies, not dependencies
  assert.ok(pkg.peerDependencies?.["@earendil-works/pi-coding-agent"]);
  assert.ok(pkg.peerDependencies?.["@earendil-works/pi-tui"]);
  assert.equal(pkg.dependencies, undefined);

  // Distributable files list
  assert.ok(Array.isArray(pkg.files));
  assert.ok(pkg.files.includes("src"));
  assert.ok(pkg.files.includes("package.json"));
  assert.ok(pkg.files.includes("LICENSE"));
  assert.ok(pkg.files.includes("README.md"));
});

test("distribution tarball excludes test suites, documents, and non-distributable files", () => {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const rawPack = JSON.parse(output);
  const packEntry = Array.isArray(rawPack) ? rawPack[0] : (rawPack["pi-iteration-diff"] ?? Object.values(rawPack)[0]);
  assert.ok(packEntry && Array.isArray(packEntry.files));
  const files: string[] = packEntry.files.map((f: { path: string }) => f.path);

  // Must include essential runtime files
  assert.ok(files.includes("package.json"));
  assert.ok(files.includes("LICENSE"));
  assert.ok(files.includes("src/index.ts"));
  assert.ok(files.includes("src/diffs/iteration-diff.ts"));
  assert.ok(files.includes("src/ui/diff-panel.ts"));

  // Must exclude tests, internal progress documents, scripts, and caches
  assert.ok(!files.some((f) => f.startsWith("tests/")));
  assert.ok(!files.some((f) => f.startsWith("scripts/")));
  assert.ok(!files.some((f) => f.startsWith("m4-test/")));
  assert.ok(!files.some((f) => /^M\d+.*\.md$/.test(f)));
  assert.ok(!files.some((f) => f === "PROGRESS.md"));
  assert.ok(!files.some((f) => f === "REQUIREMENTS.md"));
  assert.ok(!files.some((f) => f === "RESEARCH.md"));
});

test("clean installation via Pi CLI registers package and discovers extension without -e", () => {
  const tempAgent = mkdtempSync(join(tmpdir(), "pi-install-test-"));
  try {
    const installRes = runPi(["install", ROOT], { PI_CODING_AGENT_DIR: tempAgent });
    assert.equal(installRes.status, 0, `install failed: ${installRes.stderr}`);
    assert.match(installRes.stdout, /Installed/);

    const listRes = runPi(["list"], { PI_CODING_AGENT_DIR: tempAgent });
    assert.equal(listRes.status, 0, `list failed: ${listRes.stderr}`);
    assert.match(listRes.stdout, /pi-diff/);

    const settingsPath = join(tempAgent, "settings.json");
    assert.ok(existsSync(settingsPath));
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    assert.ok(Array.isArray(settings.packages));
    assert.ok(settings.packages.some((p: string | { source: string }) =>
      (typeof p === "string" ? p : p.source).includes("pi-diff")
    ));
  } finally {
    rmSync(tempAgent, { recursive: true, force: true });
  }
});

test("reinstallation and updates preserve global preferences in iteration-diff.json", () => {
  const tempAgent = mkdtempSync(join(tmpdir(), "pi-update-test-"));
  try {
    // 1. Initial install
    const installRes = runPi(["install", ROOT], { PI_CODING_AGENT_DIR: tempAgent });
    assert.equal(installRes.status, 0);

    // 2. User sets preference
    const configPath = join(tempAgent, "iteration-diff.json");
    const userPrefs = { version: 1, dockWidth: 55, rememberWidth: true };
    writeFileSync(configPath, JSON.stringify(userPrefs), { mode: 0o600 });

    // 3. Reinstall / update
    const updateRes = runPi(["install", ROOT], { PI_CODING_AGENT_DIR: tempAgent });
    assert.equal(updateRes.status, 0);

    // 4. Verify config file is untouched
    assert.ok(existsSync(configPath));
    const stored = JSON.parse(readFileSync(configPath, "utf8"));
    assert.deepEqual(stored, userPrefs);
  } finally {
    rmSync(tempAgent, { recursive: true, force: true });
  }
});

test("uninstallation removes package from settings without deleting preferences", () => {
  const tempAgent = mkdtempSync(join(tmpdir(), "pi-remove-test-"));
  try {
    // 1. Install
    runPi(["install", ROOT], { PI_CODING_AGENT_DIR: tempAgent });

    // 2. User preference file exists
    const configPath = join(tempAgent, "iteration-diff.json");
    writeFileSync(configPath, JSON.stringify({ version: 1, dockWidth: 42, rememberWidth: true }), { mode: 0o600 });

    // 3. Uninstall
    const removeRes = runPi(["remove", ROOT], { PI_CODING_AGENT_DIR: tempAgent });
    assert.equal(removeRes.status, 0, `remove failed: ${removeRes.stderr}`);

    // 4. List confirms package is gone
    const listRes = runPi(["list"], { PI_CODING_AGENT_DIR: tempAgent });
    assert.match(listRes.stdout, /No packages installed/);

    // 5. User preference file survives uninstallation
    assert.ok(existsSync(configPath), "iteration-diff.json must not be deleted on uninstallation");
  } finally {
    rmSync(tempAgent, { recursive: true, force: true });
  }
});

test("dock width store handles missing or corrupted configuration safely", () => {
  const tempAgent = mkdtempSync(join(tmpdir(), "pi-config-fallback-"));
  const origAgentDir = process.env.PI_CODING_AGENT_DIR;
  try {
    process.env.PI_CODING_AGENT_DIR = tempAgent;

    // Missing file returns status missing
    assert.deepEqual(loadDockWidth(), { status: "missing" });

    // Corrupted file (invalid JSON) returns status invalid without throwing
    const configPath = join(tempAgent, "iteration-diff.json");
    writeFileSync(configPath, "NOT_JSON{{{");
    assert.deepEqual(loadDockWidth(), { status: "invalid" });

    // Invalid schema returns status invalid
    writeFileSync(configPath, JSON.stringify({ version: 2, dockWidth: "wide" }));
    assert.deepEqual(loadDockWidth(), { status: "invalid" });

    // Valid save and load returns status ok
    saveDockWidth({ dockWidth: 50, rememberWidth: true });
    assert.deepEqual(loadDockWidth(), { status: "ok", value: { dockWidth: 50, rememberWidth: true } });
  } finally {
    if (origAgentDir !== undefined) {
      process.env.PI_CODING_AGENT_DIR = origAgentDir;
    } else {
      delete process.env.PI_CODING_AGENT_DIR;
    }
    rmSync(tempAgent, { recursive: true, force: true });
  }
});

test("installed package resolves correctly when invoked across distinct workspace projects", () => {
  const tempAgent = mkdtempSync(join(tmpdir(), "pi-multi-project-agent-"));
  const tempProjectA = mkdtempSync(join(tmpdir(), "pi-project-a-"));
  const tempProjectB = mkdtempSync(join(tmpdir(), "pi-project-b-"));
  try {
    // Install globally in test agent dir
    const installRes = runPi(["install", ROOT], { PI_CODING_AGENT_DIR: tempAgent });
    assert.equal(installRes.status, 0);

    // Both projects can discover it through user settings
    const listA = runPi(["list"], { PI_CODING_AGENT_DIR: tempAgent }, tempProjectA);
    assert.equal(listA.status, 0);
    assert.match(listA.stdout, /pi-diff/);

    const listB = runPi(["list"], { PI_CODING_AGENT_DIR: tempAgent }, tempProjectB);
    assert.equal(listB.status, 0);
    assert.match(listB.stdout, /pi-diff/);
  } finally {
    rmSync(tempAgent, { recursive: true, force: true });
    rmSync(tempProjectA, { recursive: true, force: true });
    rmSync(tempProjectB, { recursive: true, force: true });
  }
});
