import { closeSync, constants, fstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export interface SavedDockWidth { dockWidth: number; rememberWidth: boolean; autoOpen?: boolean }
export type WidthLoad = { status: "missing" | "invalid" | "error" } | { status: "ok"; value: SavedDockWidth };
export const DOCK_WIDTH_FILE = "iteration-diff.json";

export function loadDockWidth(): WidthLoad {
  let fd: number | undefined;
  try {
    fd = openSync(join(getAgentDir(), DOCK_WIDTH_FILE), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > 1024) return { status: "invalid" };
    const data: unknown = JSON.parse(readFileSync(fd, "utf8"));
    if (!data || typeof data !== "object") return { status: "invalid" };
    const value = data as Record<string, unknown>;
    if (value.version !== 1 || typeof value.dockWidth !== "number" || !Number.isFinite(value.dockWidth) ||
        value.dockWidth < 30 || value.dockWidth > 60 || typeof value.rememberWidth !== "boolean" ||
        (value.autoOpen !== undefined && typeof value.autoOpen !== "boolean")) return { status: "invalid" };
    return { status: "ok", value: { dockWidth: value.dockWidth, rememberWidth: value.rememberWidth,
      ...(value.autoOpen !== undefined ? { autoOpen: value.autoOpen } : {}) } };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: "missing" };
    if (error instanceof SyntaxError) return { status: "invalid" };
    return { status: "error" };
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function saveDockWidth(value: SavedDockWidth): void {
  const dir = getAgentDir();
  const target = join(dir, DOCK_WIDTH_FILE);
  const temp = join(dir, `${DOCK_WIDTH_FILE}.${randomUUID()}.tmp`);
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(temp, JSON.stringify({ version: 1, ...value }) + "\n", { flag: "wx", mode: 0o600 });
    renameSync(temp, target);
  } finally {
    try { unlinkSync(temp); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
