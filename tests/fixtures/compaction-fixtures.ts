import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DiffFile, DiffRow } from "../../src/diffs/iteration-diff.js";
import { workspace } from "./workspace.js";

/**
 * Isolated fixture data representing real file modifications (kind: "modified", "M").
 * Includes TypeScript nested blocks, Python indentation hierarchy, YAML nested structures,
 * hunks with additions, deletions, context, and hunks with 0 common indentation.
 */
export const nestedTsRows: DiffRow[] = [
  // Hunk 1: Nested method in class (12 spaces common indent)
  { kind: "hunk", text: "@@ -15,7 +15,7 @@ class DataService {" },
  { kind: "context", oldLine: 15, newLine: 15, text: "            if (isAuthorized(session)) {" },
  { kind: "context", oldLine: 16, newLine: 16, text: "                const query = buildQuery(filter);" },
  { kind: "removed", oldLine: 17, text: "                const result = await legacyFetch(query);" },
  { kind: "added", newLine: 17, text: "                const result = await modernFetch(query, { timeout: 5000 });" },
  { kind: "context", oldLine: 18, newLine: 18, text: "" },
  { kind: "context", oldLine: 19, newLine: 19, text: "                return transform(result);" },
  { kind: "context", oldLine: 20, newLine: 20, text: "            }" },

  // Hunk 2: Top-level function in same file (0 spaces common indent)
  { kind: "hunk", text: "@@ -40,4 +40,4 @@" },
  { kind: "context", oldLine: 40, newLine: 40, text: "export function configureDefaults(): void {" },
  { kind: "removed", oldLine: 41, text: "  setCacheSize(100);" },
  { kind: "added", newLine: 41, text: "  setCacheSize(250);" },
  { kind: "context", oldLine: 42, newLine: 42, text: "}" },
];

export const pipelinePyRows: DiffRow[] = [
  // Hunk 1: Nested generator in pipeline class (8 spaces common indent)
  { kind: "hunk", text: "@@ -28,8 +28,8 @@ class PipelineEngine:" },
  { kind: "context", oldLine: 28, newLine: 28, text: "        if dataset is not None:" },
  { kind: "context", oldLine: 29, newLine: 29, text: "            for item in dataset:" },
  { kind: "removed", oldLine: 30, text: "                yield sync_transform(item)" },
  { kind: "added", newLine: 30, text: "                yield await async_transform(item, retries=3)" },
  { kind: "context", oldLine: 31, newLine: 31, text: "        " },
  { kind: "context", oldLine: 32, newLine: 32, text: "            return completed" },

  // Hunk 2: Top-level entrypoint (0 common indent)
  { kind: "hunk", text: "@@ -55,3 +55,3 @@" },
  { kind: "context", oldLine: 55, newLine: 55, text: "def run_pipeline(config):" },
  { kind: "removed", oldLine: 56, text: "    execute_sync(config)" },
  { kind: "added", newLine: 56, text: "    execute_async(config)" },
];

export const deploymentYamlRows: DiffRow[] = [
  // Hunk 1: Nested containers spec (6 spaces common indent)
  { kind: "hunk", text: "@@ -12,7 +12,7 @@ spec:" },
  { kind: "context", oldLine: 12, newLine: 12, text: "      containers:" },
  { kind: "context", oldLine: 13, newLine: 13, text: "        - name: app" },
  { kind: "context", oldLine: 14, newLine: 14, text: "          resources:" },
  { kind: "removed", oldLine: 15, text: "            limits:" },
  { kind: "added", newLine: 15, text: "            limits:" },
  { kind: "removed", oldLine: 16, text: "              memory: 2Gi" },
  { kind: "added", newLine: 16, text: "              memory: 4Gi" },
  { kind: "context", oldLine: 17, newLine: 17, text: "" },

  // Hunk 2: Top-level metadata (0 common indent)
  { kind: "hunk", text: "@@ -1,3 +1,3 @@" },
  { kind: "context", oldLine: 1, newLine: 1, text: "apiVersion: apps/v1" },
  { kind: "removed", oldLine: 2, text: "kind: Deployment" },
  { kind: "added", newLine: 2, text: "kind: StatefulSet" },
];

export const tabsGoRows: DiffRow[] = [
  // Hunk 1: Tabs indentation (2 tabs common indent)
  { kind: "hunk", text: "@@ -10,5 +10,5 @@ func Worker() {" },
  { kind: "context", oldLine: 10, newLine: 10, text: "\t\tif ready {" },
  { kind: "removed", oldLine: 11, text: "\t\t\tprocessOld(item)" },
  { kind: "added", newLine: 11, text: "\t\t\tprocessNew(item)" },
  { kind: "context", oldLine: 12, newLine: 12, text: "\t\t}" },
];

export const mixedAmbiguousRows: DiffRow[] = [
  // Hunk with mixed tab and spaces indentation across lines
  { kind: "hunk", text: "@@ -5,3 +5,3 @@" },
  { kind: "removed", oldLine: 5, text: "\tlegacyTabIndent()" },
  { kind: "added", newLine: 5, text: "    spacesIndent()" },
  { kind: "context", oldLine: 6, newLine: 6, text: "    contextSpaces()" },
];

export const syntheticCompactedFiles: DiffFile[] = [
  { path: "src/services/nested.ts", kind: "modified", added: 2, removed: 2, getRows: () => nestedTsRows },
  { path: "pipeline.py", kind: "modified", added: 2, removed: 2, getRows: () => pipelinePyRows },
  { path: "deploy/k8s/deployment.yaml", kind: "modified", added: 2, removed: 2, getRows: () => deploymentYamlRows },
  { path: "worker/tabs.go", kind: "modified", added: 1, removed: 1, getRows: () => tabsGoRows },
  { path: "scripts/mixed.py", kind: "modified", added: 1, removed: 1, getRows: () => mixedAmbiguousRows },
];

/**
 * Creates an isolated temporary git workspace containing real modified files (M),
 * producing realistic diff hunks for integration testing.
 */
export async function createModifiedWorkspace(): Promise<{
  root: string;
  git: (...args: string[]) => Promise<Buffer>;
  write: (path: string, content: string | Buffer) => Promise<void>;
  writeModifiedFiles: () => Promise<void>;
  close: () => Promise<void>;
}> {
  const ws = await workspace();
  const safeWrite = async (path: string, content: string | Buffer): Promise<void> => {
    await mkdir(dirname(join(ws.root, path)), { recursive: true });
    await ws.write(path, content);
  };

  // Commit initial versions
  await safeWrite("src/nested.ts", `
export class BaseService {
  async process(session: any, filter: any) {
            if (isAuthorized(session)) {
                const query = buildQuery(filter);
                const result = await legacyFetch(query);

                return transform(result);
            }
  }
}

export function configureDefaults(): void {
  setCacheSize(100);
}
`.trim());

  await ws.write("pipeline.py", `
class PipelineEngine:
    async def run(dataset):
        if dataset is not None:
            for item in dataset:
                yield sync_transform(item)
        
            return completed

def run_pipeline(config):
    execute_sync(config)
`.trim());

  await ws.write("deployment.yaml", `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-app
spec:
  template:
    spec:
      containers:
        - name: app
          resources:
            limits:
              memory: 2Gi
`.trim());

  await ws.git("add", ".");
  await ws.git("commit", "-m", "Initial commit");

  return {
    root: ws.root,
    git: ws.git,
    write: safeWrite,
    async writeModifiedFiles() {
      await safeWrite("src/nested.ts", `
export class BaseService {
  async process(session: any, filter: any) {
            if (isAuthorized(session)) {
                const query = buildQuery(filter);
                const result = await modernFetch(query, { timeout: 5000 });

                return transform(result);
            }
  }
}

export function configureDefaults(): void {
  setCacheSize(250);
}
`.trim());

      await ws.write("pipeline.py", `
class PipelineEngine:
    async def run(dataset):
        if dataset is not None:
            for item in dataset:
                yield await async_transform(item, retries=3)
        
            return completed

def run_pipeline(config):
    execute_async(config)
`.trim());

      await ws.write("deployment.yaml", `
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: test-app
spec:
  template:
    spec:
      containers:
        - name: app
          resources:
            limits:
              memory: 4Gi
`.trim());
    },
    close: ws.close,
  };
}
