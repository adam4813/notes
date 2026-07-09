import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import { parseNote, type ParsedLink } from "./parse";
import { CLEAR_SQL, SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

export interface IndexInputFile {
  path: string;
  content: string;
  mtimeMs: number;
  /** When false, file is indexed for FTS but excluded from wikilink autocomplete. */
  linkable?: boolean;
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
}

export interface SearchFilters {
  /** Only notes carrying this exact tag. */
  tag?: string;
  /** Only notes of this type (e.g. "markdown", "table", "canvas", "board"). */
  type?: string;
  /** Only notes whose path starts with this folder prefix. */
  pathPrefix?: string;
}

export interface BacklinkResult {
  path: string;
  title: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

function contentHash(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}

function pathWithoutExtension(path: string): string {
  return path.replace(/\.[^./]+$/, "");
}

function baseWithoutExtension(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.[^./]+$/, "");
}

/** Builds an FTS5 MATCH expression doing prefix search on each term. */
function toFtsMatch(query: string): string {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"*`);
  return terms.join(" ");
}

/**
 * SQLite-backed index over a Tome. Derived and rebuildable — never the source
 * of truth. The DB auto-rebuilds if the on-disk schema version differs.
 */
export class NoteIndex {
  private readonly db: Database.Database;

  constructor(location = ":memory:") {
    this.db = new Database(location);
    this.db.pragma("journal_mode = WAL");
    this.initSchema();
  }

  private initSchema(): void {
    if (this.readVersion() !== SCHEMA_VERSION) {
      this.db.exec(`
        DROP TABLE IF EXISTS notes;
        DROP TABLE IF EXISTS links;
        DROP TABLE IF EXISTS tags;
        DROP TABLE IF EXISTS frontmatter;
        DROP TABLE IF EXISTS notes_fts;
        DROP TABLE IF EXISTS meta;
      `);
    }
    this.db.exec(SCHEMA_SQL);
    this.db
      .prepare(
        "INSERT INTO meta(key, value) VALUES('schema_version', ?) " +
          "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(String(SCHEMA_VERSION));
  }

  private readVersion(): number | undefined {
    try {
      const row = this.db
        .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
        .get() as { value: string } | undefined;
      return row ? Number(row.value) : undefined;
    } catch {
      return undefined;
    }
  }

  private removeRows(path: string): void {
    this.db.prepare("DELETE FROM notes WHERE path = ?").run(path);
    this.db.prepare("DELETE FROM links WHERE src = ?").run(path);
    this.db.prepare("DELETE FROM tags WHERE path = ?").run(path);
    this.db.prepare("DELETE FROM frontmatter WHERE path = ?").run(path);
    this.db.prepare("DELETE FROM notes_fts WHERE path = ?").run(path);
  }

  upsert(file: IndexInputFile): void {
    const hash = contentHash(file.content);
    const existing = this.db.prepare("SELECT hash FROM notes WHERE path = ?").get(file.path) as
      | { hash: string }
      | undefined;
    if (existing?.hash === hash) {
      return;
    }

    const parsed = parseNote(file.path, file.content);
    const run = this.db.transaction(() => {
      this.removeRows(file.path);
      this.db
        .prepare("INSERT INTO notes(path, title, type, mtime, hash, linkable) VALUES(?, ?, ?, ?, ?, ?)")
        .run(file.path, parsed.title, parsed.type, file.mtimeMs, hash, file.linkable === false ? 0 : 1);

      const linkStmt = this.db.prepare(
        "INSERT INTO links(src, target, alias, heading) VALUES(?, ?, ?, ?)",
      );
      for (const link of parsed.links) {
        linkStmt.run(file.path, link.target, link.alias ?? null, link.heading ?? null);
      }

      const tagStmt = this.db.prepare("INSERT INTO tags(path, tag) VALUES(?, ?)");
      for (const tag of parsed.tags) {
        tagStmt.run(file.path, tag);
      }

      const fmStmt = this.db.prepare("INSERT INTO frontmatter(path, key, value) VALUES(?, ?, ?)");
      for (const [key, value] of Object.entries(parsed.frontmatter)) {
        fmStmt.run(file.path, key, JSON.stringify(value));
      }

      this.db
        .prepare("INSERT INTO notes_fts(path, title, body) VALUES(?, ?, ?)")
        .run(file.path, parsed.title, parsed.bodyText);
    });
    run();
  }

  remove(path: string): void {
    const run = this.db.transaction(() => this.removeRows(path));
    run();
  }

  rebuild(files: IndexInputFile[]): void {
    const run = this.db.transaction((input: IndexInputFile[]) => {
      this.db.exec(CLEAR_SQL);
      for (const file of input) {
        this.upsert(file);
      }
    });
    run(files);
  }

  noteCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM notes").get() as { count: number };
    return row.count;
  }

  allNotes(): { path: string; title: string; type: string }[] {
    return this.db.prepare("SELECT path, title, type FROM notes WHERE linkable = 1 ORDER BY title").all() as {
      path: string;
      title: string;
      type: string;
    }[];
  }

  search(query: string, limitOrFilters?: number | SearchFilters, maybeFilters?: SearchFilters): SearchResult[] {
    const limit = typeof limitOrFilters === "number" ? limitOrFilters : 50;
    const filters = (typeof limitOrFilters === "number" ? maybeFilters : limitOrFilters) ?? {};
    const match = toFtsMatch(query);
    const hasFilters = Boolean(filters.tag || filters.type || filters.pathPrefix);
    if (!match) {
      return hasFilters ? this.listByFilters(filters, limit) : [];
    }

    const conditions: string[] = ["notes_fts MATCH ?"];
    const params: unknown[] = [match];
    if (filters.type) {
      conditions.push("n.type = ?");
      params.push(filters.type);
    }
    if (filters.pathPrefix) {
      conditions.push("notes_fts.path LIKE ?");
      params.push(`${filters.pathPrefix}/%`);
    }
    if (filters.tag) {
      conditions.push(
        "EXISTS (SELECT 1 FROM tags t WHERE t.path = notes_fts.path AND (t.tag = ? OR t.tag LIKE ?))",
      );
      params.push(filters.tag, `${filters.tag}/%`);
    }
    params.push(limit);

    return this.db
      .prepare(
        "SELECT notes_fts.path AS path, notes_fts.title AS title, " +
          "snippet(notes_fts, 2, '<mark>', '</mark>', '…', 12) AS snippet " +
          "FROM notes_fts JOIN notes n ON n.path = notes_fts.path " +
          `WHERE ${conditions.join(" AND ")} ORDER BY rank LIMIT ?`,
      )
      .all(...params) as SearchResult[];
  }

  /** Lists notes matching only the filters (no full-text query). */
  private listByFilters(filters: SearchFilters, limit: number): SearchResult[] {
    const conditions: string[] = ["1 = 1"];
    const params: unknown[] = [];
    if (filters.type) {
      conditions.push("n.type = ?");
      params.push(filters.type);
    }
    if (filters.pathPrefix) {
      conditions.push("n.path LIKE ?");
      params.push(`${filters.pathPrefix}/%`);
    }
    if (filters.tag) {
      conditions.push(
        "EXISTS (SELECT 1 FROM tags t WHERE t.path = n.path AND (t.tag = ? OR t.tag LIKE ?))",
      );
      params.push(filters.tag, `${filters.tag}/%`);
    }
    params.push(limit);
    const rows = this.db
      .prepare(
        `SELECT n.path AS path, n.title AS title FROM notes n WHERE ${conditions.join(" AND ")} ` +
          "ORDER BY n.title LIMIT ?",
      )
      .all(...params) as { path: string; title: string }[];
    return rows.map((row) => ({ path: row.path, title: row.title, snippet: "" }));
  }

  backlinksOf(path: string): BacklinkResult[] {
    const full = pathWithoutExtension(path).toLowerCase();
    const base = baseWithoutExtension(path).toLowerCase();
    return this.db
      .prepare(
        "SELECT DISTINCT n.path AS path, n.title AS title " +
          "FROM links l JOIN notes n ON n.path = l.src " +
          "WHERE lower(l.target) IN (?, ?) ORDER BY n.path",
      )
      .all(full, base) as BacklinkResult[];
  }

  outgoingLinks(path: string): ParsedLink[] {
    const rows = this.db
      .prepare("SELECT target, alias, heading FROM links WHERE src = ? ORDER BY rowid")
      .all(path) as { target: string; alias: string | null; heading: string | null }[];
    return rows.map((row) => ({
      target: row.target,
      ...(row.alias ? { alias: row.alias } : {}),
      ...(row.heading ? { heading: row.heading } : {}),
    }));
  }

  notesByTag(tag: string): string[] {
    const rows = this.db
      .prepare("SELECT DISTINCT path FROM tags WHERE tag = ? OR tag LIKE ? ORDER BY path")
      .all(tag, `${tag}/%`) as { path: string }[];
    return rows.map((row) => row.path);
  }

  allTags(): TagCount[] {
    return this.db
      .prepare("SELECT tag, COUNT(*) AS count FROM tags GROUP BY tag ORDER BY count DESC, tag")
      .all() as TagCount[];
  }

  resolveWikilink(text: string): string | undefined {
    const target = text.split("#")[0].trim().toLowerCase();
    if (!target) {
      return undefined;
    }
    // Match by basename or path-without-extension across linkable notes only.
    const rows = this.db.prepare("SELECT path FROM notes WHERE linkable = 1").all() as { path: string }[];
    const matches = rows
      .filter(
        (row) =>
          baseWithoutExtension(row.path).toLowerCase() === target ||
          pathWithoutExtension(row.path).toLowerCase() === target,
      )
      .sort((a, b) => a.path.length - b.path.length);

    return matches[0]?.path;
  }

  close(): void {
    this.db.close();
  }
}
