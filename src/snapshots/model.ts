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
  for (const path of new Set([...before.files.keys(), ...after.files.keys()])) {
    const old = before.files.get(path);
    const next = after.files.get(path);
    if ((!old && (!before.enumerationComplete || before.omitted.has(path))) ||
        (!next && (!after.enumerationComplete || after.omitted.has(path)))) {
      if (!issues.includes("unknown-endpoint")) issues.push("unknown-endpoint");
      continue;
    }
    if (old && next && old.equals(next)) continue;
    changes.push({ path, kind: !old ? "created" : !next ? "deleted" : "modified", before: old, after: next });
  }
  changes.sort((a, b) => a.path.localeCompare(b.path));
  return { status: issues.length || !before.enumerationComplete || !after.enumerationComplete ? "partial" : "complete", changes, issues };
}
