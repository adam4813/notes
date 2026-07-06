export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS notes (
  path TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  mtime REAL NOT NULL,
  hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
  src TEXT NOT NULL,
  target TEXT NOT NULL,
  alias TEXT,
  heading TEXT
);
CREATE INDEX IF NOT EXISTS idx_links_src ON links(src);
CREATE INDEX IF NOT EXISTS idx_links_target ON links(target);

CREATE TABLE IF NOT EXISTS tags (
  path TEXT NOT NULL,
  tag TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
CREATE INDEX IF NOT EXISTS idx_tags_path ON tags(path);

CREATE TABLE IF NOT EXISTS frontmatter (
  path TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT
);
CREATE INDEX IF NOT EXISTS idx_frontmatter_path ON frontmatter(path);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(path UNINDEXED, title, body);
`;

export const CLEAR_SQL = `
DELETE FROM notes;
DELETE FROM links;
DELETE FROM tags;
DELETE FROM frontmatter;
DELETE FROM notes_fts;
`;
