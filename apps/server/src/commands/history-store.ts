import { join } from "node:path";
import fs from "node:fs";
import { constants } from "node:fs";
import { access, writeFile } from "node:fs/promises";
import git from "isomorphic-git";
import type { Tome } from "@notes/tome";
import { lineDiff, type DiffRow } from "./line-diff";

/** A single committed version of a file (one git commit that touched it). */
export interface HistoryVersion {
  oid: string;
  shortOid: string;
  message: string;
  /** Author time in milliseconds since the epoch. */
  timestamp: number;
  author: string;
  /** Lines added in this version, relative to its parent. */
  additions: number;
  /** Lines removed in this version, relative to its parent. */
  deletions: number;
}

export interface FileHistory {
  /** Whether the Tome is tracked by git yet. */
  initialized: boolean;
  versions: HistoryVersion[];
  /** Whether the working file differs from the latest committed version. */
  hasUncommittedChanges: boolean;
}

export interface VersionDiff {
  rows: DiffRow[];
  additions: number;
  deletions: number;
  /** The file content at the selected version (used to restore it). */
  content: string;
  message: string;
  timestamp: number;
  author: string;
}

const GITIGNORE = `# Notes app — rebuildable index and temporary files (never version these)
.notes/index.db
.notes/index.db-journal
.notes/index.db-shm
.notes/index.db-wal
*.tmp-*
`;

/** Decodes raw git blob bytes to a UTF-8 string. */
const decoder = new TextDecoder();

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await access(absolutePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Whether the Tome folder already contains a git repository. */
export async function isRepo(dir: string): Promise<boolean> {
  return pathExists(join(dir, ".git"));
}

/** Reads the file's content at a given commit/ref, or null when it is absent. */
async function blobTextAt(dir: string, oid: string, filepath: string): Promise<string | null> {
  try {
    const { blob } = await git.readBlob({ fs, dir, oid, filepath });
    return decoder.decode(blob);
  } catch {
    return null;
  }
}

/** Uses the repo's configured identity when available, else an app default. */
async function resolveAuthor(dir: string): Promise<{ name: string; email: string }> {
  const name =
    (await git.getConfig({ fs, dir, path: "user.name" }).catch(() => undefined)) || "Notes";
  const email =
    (await git.getConfig({ fs, dir, path: "user.email" }).catch(() => undefined)) ||
    "notes@localhost";
  return { name, email };
}

/**
 * Ensures the Tome is a git repository, creating one (and a sensible
 * `.gitignore`) on first use. Safe to call repeatedly.
 */
export async function ensureRepo(dir: string): Promise<void> {
  if (!(await isRepo(dir))) {
    await git.init({ fs, dir, defaultBranch: "main" });
  }
  const gitignore = join(dir, ".gitignore");
  if (!(await pathExists(gitignore))) {
    await writeFile(gitignore, GITIGNORE, "utf8");
  }
}

/**
 * Commits the entire Tome as one version (the "backup" action). Stages every
 * change the index would (adds, edits, deletions) while honoring `.gitignore`.
 * Returns `created: false` when there is nothing new to snapshot.
 */
export async function snapshot(
  dir: string,
  message: string,
): Promise<{ created: boolean; oid?: string }> {
  await ensureRepo(dir);
  const matrix = await git.statusMatrix({ fs, dir });
  // statusMatrix row: [filepath, headStatus, workdirStatus, stageStatus].
  // head !== workdir means the working tree differs from the last commit.
  const changed = matrix.filter(([, head, workdir]) => head !== workdir);
  if (changed.length === 0) {
    return { created: false };
  }
  for (const [filepath, , workdir] of changed) {
    if (workdir === 0) {
      await git.remove({ fs, dir, filepath });
    } else {
      await git.add({ fs, dir, filepath });
    }
  }
  const oid = await git.commit({
    fs,
    dir,
    message: message.trim() || defaultMessage(),
    author: await resolveAuthor(dir),
  });
  return { created: true, oid };
}

/** Default snapshot label, e.g. "Snapshot 2026-10-31 14:02". */
export function defaultMessage(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `Snapshot ${date} ${time}`;
}

/** Reports whether the Tome is tracked by git yet. */
export async function historyStatus(dir: string): Promise<{ initialized: boolean }> {
  return { initialized: await isRepo(dir) };
}

/**
 * Lists the versions (commits) that touched a file, newest first, with the
 * number of lines each version changed relative to its parent.
 */
export async function fileHistory(tome: Tome, filepath: string, limit = 100): Promise<FileHistory> {
  const dir = tome.root;
  if (!(await isRepo(dir))) {
    return { initialized: false, versions: [], hasUncommittedChanges: false };
  }

  // Deliberately not using `follow: true`: rename-following would list
  // pre-rename commits under the *current* path, but their blob only exists
  // under the old name, so both the change counts and the restorable content
  // would resolve to empty. Listing a version we cannot restore risks data
  // loss, so a renamed note's history simply starts at its current name.
  let commits: Awaited<ReturnType<typeof git.log>> = [];
  try {
    commits = await git.log({ fs, dir, filepath, force: true, depth: limit });
  } catch {
    commits = [];
  }

  const versions: HistoryVersion[] = [];
  for (const entry of commits) {
    const parentOid = entry.commit.parent[0];
    const parentText = parentOid ? ((await blobTextAt(dir, parentOid, filepath)) ?? "") : "";
    const currentText = (await blobTextAt(dir, entry.oid, filepath)) ?? "";
    const { additions, deletions } = lineDiff(parentText, currentText);
    versions.push({
      oid: entry.oid,
      shortOid: entry.oid.slice(0, 7),
      message: entry.commit.message.trim(),
      timestamp: entry.commit.author.timestamp * 1000,
      author: entry.commit.author.name,
      additions,
      deletions,
    });
  }

  const headOid = await git.resolveRef({ fs, dir, ref: "HEAD" }).catch(() => null);
  const headText = headOid ? await blobTextAt(dir, headOid, filepath) : null;
  let workText: string | null = null;
  try {
    workText = await tome.read(filepath);
  } catch {
    workText = null;
  }
  const hasUncommittedChanges = (workText ?? "") !== (headText ?? "");

  return { initialized: true, versions, hasUncommittedChanges };
}

/**
 * Computes the diff a version introduced (its content versus its parent) and
 * returns that version's full content so the UI can restore it.
 */
export async function versionDiff(tome: Tome, filepath: string, oid: string): Promise<VersionDiff> {
  const dir = tome.root;
  const commit = await git.readCommit({ fs, dir, oid });
  const parentOid = commit.commit.parent[0];
  const parentText = parentOid ? ((await blobTextAt(dir, parentOid, filepath)) ?? "") : "";
  const content = (await blobTextAt(dir, oid, filepath)) ?? "";
  const { rows, additions, deletions } = lineDiff(parentText, content);
  return {
    rows,
    additions,
    deletions,
    content,
    message: commit.commit.message.trim(),
    timestamp: commit.commit.author.timestamp * 1000,
    author: commit.commit.author.name,
  };
}
