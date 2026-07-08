# Phase 11 — Search, Tags & Info Panels UI

**Status:** ✅ Complete
**Depends on:** 2, 3, 5

## Goal

Surface the Phase 2 index in polished UI: a **search** pane (full-text + filters), a **tag**
pane, in-note find, and finalized info panels. This makes the knowledge graph navigable
without a graph view (which stays deferred but data-ready).

## Tasks

### Task: Search pane  `Wave 1`
A dedicated search panel over FTS5: query input, ranked results with highlighted snippets,
filters (path/folder, tag, note type), and click-to-open (jumping to the match). Keyboard
navigable; debounced live search.

### Task: In-note find  `Wave 1`
`Ctrl/Cmd+F` find (and find/replace) within the active note, with match highlighting and
next/previous navigation, working in both source and rendered modes.

### Task: Tag pane  `Wave 2`
A tag panel listing all tags with counts (from `allTags()`), nested tag support (`a/b`),
click-to-filter (shows notes for a tag), and integration with search filters.

### Task: Info panels finalization  `Wave 2`
Polish Backlinks + Outline (from Phase 5) and add an optional properties/frontmatter panel.
Consistent docking, collapsing, and live updates across all right-sidebar panels.

### Task: Tests
Vitest: search filter query building, tag aggregation, find/replace logic. Playwright: search
returns results and opens a match; filter by tag; in-note find/replace; tag pane filters notes.

## Verification Checklist
- [ ] Full-text search returns ranked, highlighted results with working filters
- [ ] In-note find/replace works in source and rendered modes
- [ ] Tag pane lists tags with counts, supports nesting, and filters notes
- [ ] Right-sidebar panels (backlinks, outline, properties) are consistent and live
- [ ] Results/open actions route via commands and the index
- [ ] `npm run typecheck && npm test && npm run test:e2e` green

## 🛑 GATE
1. Are search relevance, filters, and snippets good enough for daily use?
2. Do you want find-and-replace across the whole Tome now, or just in-note for MVP?
3. Should nested tags and tag filtering behave hierarchically by default?
4. Any blocking issues?
5. Additional feedback?

## Git Checkpoint
Stage: `apps/web/**` (search/tag panes, find, panels), related index queries, tests.

Commit message:
`feat: search pane, in-note find, tag pane, and finalized info panels`

## Feedback
**2025 session (GATE — user reviewed):**
- Search relevance/filters/snippets: good enough for daily use. ✅
- Replace scope: **in-note only** for MVP (whole-Tome find/replace deferred — TODO created).
- Nested tags: should filter **hierarchically** by default (selecting `a` includes `a/b`) —
  deferred TODO created (current filter is exact-tag).
- **Bugs reported & fixed this session:**
  1. Tag/type/folder filters returned nothing unless a text query was also present — search
     now supports filter-only queries (empty text + filters lists matching notes).
  2. Find/replace was undiscoverable — added a right-aligned 🔍 find button to the editor toolbar.
  3. The Word Count command appeared twice in the palette — plugin command/status registration
     now dedupes by id (guards React StrictMode double-mount), plus effect cleanup.
  4. The sample plugin's default hotkey `Mod+Shift+W` closes the browser tab — changed to
     `Mod+Alt+W`.
- No blocking issues; 86 unit tests, 18 Playwright specs, typecheck/lint/build all green.

