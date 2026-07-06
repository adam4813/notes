# Phase 2 — SQLite Index & Search Engine

**Status:** ✅ Complete
**Depends on:** 1

## Goal

A rebuildable **SQLite index** (via `better-sqlite3`) over the Tome: notes, frontmatter,
wikilinks, tags, and full-text search. The DB is derived and gitignored; it can be dropped
and rebuilt from files at any time. Keeps itself current via the Phase 1 watcher.

## Tasks

### Task: Index schema & migrations  `Wave 1`
`packages/index`: SQLite schema — `notes(path, title, type, mtime, hash)`,
`links(src, target, kind)`, `tags(path, tag)`, `frontmatter(path, key, value)`, and an
**FTS5** virtual table for note body/title. Versioned migrations; store schema version.

### Task: Markdown parsing & extraction  `Wave 1`
Parse markdown (remark/`unified` or `markdown-it`) to extract: title (H1 or frontmatter),
`[[wikilinks]]` (+ heading/block refs), `#tags`, and YAML frontmatter key/values. Compute a
content hash for change detection.

### Task: Indexer — full & incremental  `Wave 2`
`buildIndex()` for a full scan; `reindexPath()` for a single file. Subscribe to Phase 1
`TomeChange` events to incrementally update on create/modify/delete/rename. Debounced batch
reindex for bulk changes (e.g., git pull). Skip unchanged files via hash.

### Task: Query API  `Wave 2`
Expose: `search(query, filters)` (FTS5, snippet highlights), `backlinksOf(path)`,
`outgoingLinks(path)`, `notesByTag(tag)`, `allTags()`, `resolveWikilink(text)` (name →
path, with ambiguity handling). Surface these as commands on the bus + server routes.

### Task: Rebuild & integrity
`rebuildIndex` command (drop + full scan). On startup, detect stale/missing DB or schema
mismatch and rebuild automatically. Ensure DB file lives outside committed content and is
gitignored.

### Task: Tests
Vitest against a fixture Tome: link extraction (incl. aliases/headings), tag extraction,
FTS search relevance/snippets, backlink correctness, incremental reindex on simulated change,
full rebuild determinism.

## Verification Checklist
- [ ] Full index build over a fixture Tome produces correct links/tags/frontmatter
- [ ] FTS5 search returns ranked results with highlighted snippets
- [ ] Backlinks and outgoing links are accurate, including alias/heading links
- [ ] Editing/creating/deleting a file incrementally updates the index (via watcher)
- [ ] Dropping the DB and rebuilding yields identical results
- [ ] DB is gitignored and never treated as source of truth
- [ ] `npm run typecheck && npm test` green

## 🛑 GATE
1. Is the index schema sufficient for MVP (search, backlinks, tags)? Anything to add now
   for cheap future-proofing (e.g., graph, embeddings)?
2. Is FTS5 ranking acceptable, or do you want configurable relevance/tokenization?
3. How should ambiguous wikilinks (same basename in two folders) resolve?
4. Any blocking issues?
5. Additional feedback?

## Git Checkpoint
Stage: `packages/index/**`, server route/command additions, tests, `.gitignore` (DB path).

Commit message:
`feat: sqlite index with links, tags, and full-text search`

## Feedback

**2026-07-06 — GATE (autonomous):** Proceeded with recommended answers (none blocking):
- **Schema** is sufficient for MVP. The `links` table already stores the full link graph, so a
  future graph view needs only a query + UI (no re-index). Embeddings/semantic search deferred.
- **FTS5 ranking** (bm25 default `rank`) is acceptable; queries use per-term prefix matching
  (`"term"*`) for a responsive search box.
- **Ambiguous wikilinks** resolve to the **shortest matching path** (basename or path-without-ext,
  case-insensitive). Good enough for MVP; a disambiguation UI can come later.

Implemented `@notes/index` (better-sqlite3 + FTS5, gray-matter frontmatter, wikilink/tag
extraction, content-hash change detection) with a Tome-local `.notes/index.db` (gitignored,
auto-rebuilt on schema mismatch). Server wires an `IndexService` (full build on start +
incremental reindex from the watcher) and `index.*` commands/REST routes.

Verified: `typecheck`, `lint`, `test` (34 passing; 11 new in index), and a **live check** —
search snippets, backlinks, tags, `resolve`, and **incremental reindex** (creating `linker.md`
instantly updated backlinks via the watcher).

_Deferred: graph-view data endpoint, embeddings, tokenizer/relevance tuning, block references._
