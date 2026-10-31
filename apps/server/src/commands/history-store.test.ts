import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Tome } from "@notes/tome";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  fileHistory,
  historyStatus,
  isRepo,
  snapshot,
  versionDiff,
} from "./history-store";

let root = "";
let tome: Tome;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "notes-history-"));
  tome = new Tome(root);
  await tome.ensureRoot();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("history-store", () => {
  it("reports uninitialized before the first snapshot", async () => {
    expect(await isRepo(root)).toBe(false);
    expect(await historyStatus(root)).toEqual({ initialized: false });
    const history = await fileHistory(tome, "note.md");
    expect(history).toEqual({ initialized: false, versions: [], hasUncommittedChanges: false });
  });

  it("creates a repo and a .gitignore on first snapshot", async () => {
    await tome.write("note.md", "hello\n");
    const result = await snapshot(root, "first version");
    expect(result.created).toBe(true);
    expect(await isRepo(root)).toBe(true);
    expect(await tome.exists(".gitignore")).toBe(true);
    expect(await tome.read(".gitignore")).toContain(".notes/index.db");
  });

  it("does not create an empty snapshot when nothing changed", async () => {
    await tome.write("note.md", "hello\n");
    await snapshot(root, "first");
    const second = await snapshot(root, "noop");
    expect(second.created).toBe(false);
  });

  it("lists versions newest-first with per-version change counts", async () => {
    await tome.write("note.md", "line1\nline2\n");
    await snapshot(root, "first");
    await tome.write("note.md", "line1\nline2 edited\nline3\n");
    await snapshot(root, "second");

    const history = await fileHistory(tome, "note.md");
    expect(history.initialized).toBe(true);
    expect(history.versions).toHaveLength(2);
    expect(history.versions[0].message).toBe("second");
    expect(history.versions[0].additions).toBe(2); // "line2 edited" + "line3"
    expect(history.versions[0].deletions).toBe(1); // original "line2"
    expect(history.versions[1].message).toBe("first");
    expect(history.versions[1].additions).toBe(2); // initial two lines
    expect(history.versions[1].deletions).toBe(0);
    expect(history.hasUncommittedChanges).toBe(false);
  });

  it("flags uncommitted working-tree changes", async () => {
    await tome.write("note.md", "v1\n");
    await snapshot(root, "first");
    await tome.write("note.md", "v1 edited\n");
    const history = await fileHistory(tome, "note.md");
    expect(history.hasUncommittedChanges).toBe(true);
  });

  it("returns a version diff with content for restoring", async () => {
    await tome.write("note.md", "alpha\n");
    await snapshot(root, "first");
    await tome.write("note.md", "alpha\nbeta\n");
    const second = await snapshot(root, "second");

    const diff = await versionDiff(tome, "note.md", second.oid!);
    expect(diff.content).toBe("alpha\nbeta\n");
    expect(diff.additions).toBe(1);
    expect(diff.deletions).toBe(0);
    expect(diff.rows).toEqual([
      { type: "context", text: "alpha", oldLine: 1, newLine: 1 },
      { type: "add", text: "beta", newLine: 2 },
    ]);
  });

  it("lists a renamed note's current version with restorable content", async () => {
    await tome.write("old-name.md", "alpha\n");
    await snapshot(root, "first");
    await tome.write("old-name.md", "alpha\nbeta\n");
    await snapshot(root, "second");
    // A pure rename (content unchanged) is exactly what git rename-detection
    // would "follow" across — the case that previously surfaced empty,
    // unrestorable blobs for the pre-rename versions.
    await tome.rename("old-name.md", "new-name.md");
    const renamed = await snapshot(root, "renamed");

    // History under the new name starts at the rename, and every listed
    // version must resolve to real content (never an empty blob that a restore
    // would clobber the file with).
    const history = await fileHistory(tome, "new-name.md");
    expect(history.initialized).toBe(true);
    expect(history.versions.length).toBeGreaterThanOrEqual(1);
    expect(history.versions[0].message).toBe("renamed");
    for (const version of history.versions) {
      const diff = await versionDiff(tome, "new-name.md", version.oid);
      expect(diff.content.length).toBeGreaterThan(0);
    }

    const diff = await versionDiff(tome, "new-name.md", renamed.oid!);
    expect(diff.content).toBe("alpha\nbeta\n");
  });

  it("excludes the rebuildable index from snapshots via .gitignore", async () => {
    await tome.mkdir(".notes");
    await tome.write(".notes/index.db", "binary-ish");
    await tome.write("note.md", "content\n");
    await snapshot(root, "first");
    // The index db must never appear in a file's history, and committing again
    // with only the ignored file touched must be a no-op.
    await tome.write(".notes/index.db", "changed");
    const second = await snapshot(root, "second");
    expect(second.created).toBe(false);
  });
});
