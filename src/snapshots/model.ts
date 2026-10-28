/** Byte content only: modes, renames and intermediate writes are outside M1. */
export interface Snapshot {
  readonly root: string;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly files: ReadonlyMap<string, Buffer>;
  readonly omitted: ReadonlyMap<string, string>;
  readonly enumerationComplete: boolean;
  readonly issues: readonly string[];
  readonly bytes: number;
}

export interface FileDelta {
  readonly path: string;
  readonly kind: "created" | "modified" | "deleted";
  readonly before?: Buffer;
  readonly after?: Buffer;
}

export interface NetDelta {
  readonly status: "complete" | "partial";
  readonly changes: readonly FileDelta[];
  readonly issues: readonly string[];
}

/** Missing content is absence only after a full enumeration, never after omission. */
export function compareSnapshots(before: Snapshot, after: Snapshot): NetDelta {
  if (before.root !== after.root) throw new Error("Snapshot roots differ");
  const issues = [...new Set([...before.issues, ...after.issues])];
  const changes: FileDelta[] = [];
  const unknown = (snapshot: Snapshot, path: string): boolean => {
    if (!snapshot.enumerationComplete) return true;
    const parts = path.split("/");
    return parts.some((_, i) => {
      const prefix = parts.slice(0, i + 1).join("/");
      return snapshot.omitted.has(prefix) || snapshot.omitted.has(`${prefix}/`);
    });
  };
  for (const path of new Set([...before.omitted.keys(), ...after.omitted.keys()])) {
    const old = before.omitted.get(path);
    const next = after.omitted.get(path);
    if ((old?.startsWith("symlink:") || next?.startsWith("symlink:")) && old !== next &&
        !issues.includes("unknown-endpoint")) issues.push("unknown-endpoint");
  }
  for (const path of new Set([...before.files.keys(), ...after.files.keys()])) {
    const old = before.files.get(path);
    const next = after.files.get(path);
    if ((!old && unknown(before, path)) || (!next && unknown(after, path))) {
      if (!issues.includes("unknown-endpoint")) issues.push("unknown-endpoint");
      continue;
    }
    if (old && next && old.equals(next)) continue;
    changes.push({ path, kind: !old ? "created" : !next ? "deleted" : "modified", before: old, after: next });
  }
  changes.sort((a, b) => a.path.localeCompare(b.path));
  return { status: issues.length || !before.enumerationComplete || !after.enumerationComplete ? "partial" : "complete", changes, issues };
}
