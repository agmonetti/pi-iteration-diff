import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function workspace(): Promise<{
  root: string;
  git: (...args: string[]) => Promise<Buffer>;
  write: (path: string, content: string | Buffer) => Promise<void>;
  close: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), "pi-m1-"));
  const git = async (...args: string[]): Promise<Buffer> => (await exec("git", ["-C", root, ...args], { encoding: "buffer" })).stdout;
  try {
    await git("init", "-q");
    return { root, git, write: (path, content) => writeFile(join(root, path), content), close: () => rm(root, { recursive: true, force: true }) };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}
