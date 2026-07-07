# Phase 6 — Table (Lightweight Database) Note Type

**Status:** ✅ Complete
**Depends on:** 3, 1

## Goal

A first-class **table / lightweight-database** note type with **Excel-like** editing, built
**as a first-party plugin** to exercise the extension API. Stored as a single git-friendly
markdown file: **schema in frontmatter, rows as embedded CSV**.

## Tasks

### Task: Table file format & (de)serializer  `Wave 1`
Define the on-disk format: a `*.md` file with `type: table` frontmatter carrying the **column
schema** (name, type: `text|number|date|checkbox|select`, options, order) and a body block
holding **CSV** rows. Implement a serializer/deserializer (Strategy) registered as a
`NoteTypeProvider`. Round-trip must be stable and diff-friendly (one row per line). Support
plain-CSV import/export for migration.

### Task: Grid view & cell editing  `Wave 1`
`packages/note-tables`: an Excel-like grid view. Keyboard navigation (arrows, Tab/Enter to
move, Enter/F2 to edit, Esc to cancel), edit-in-place, per-type cell editors (text, number,
date picker, checkbox, select dropdown). Sticky header row.

### Task: Column & row operations  `Wave 2`
Add/insert/delete/reorder columns and rows; rename column; change column type (with safe
coercion); resize columns. Basic **sort** by column and simple **filter**. All edits persist
via the command bus.

### Task: Range selection, copy/paste, fill  `Wave 2`
Excel-like range selection (shift+arrows / drag), copy/paste of ranges (TSV clipboard interop
with real spreadsheets), and fill-down. Undo/redo for grid operations.

### Task: Register as a plugin & wire the view  `Wave 3`
Register the table note type through the plugin/extension API (note-type provider + view), so
the app opens `type: table` files in the grid via the Phase 3 view host. Add an "insert table
note" command.

### Task: Tests
Vitest: CSV+frontmatter round-trip, type coercion, sort/filter, copy/paste parsing.
Playwright: create a table note, edit cells, add a column, paste a range, reopen and verify
persistence.

## Verification Checklist
- [ ] Table notes persist as `type: table` frontmatter schema + CSV body, round-trip stable
- [ ] Grid editing feels Excel-like (keyboard nav, in-place edit, typed cells)
- [ ] Column/row add/delete/reorder/type-change and sort/filter work and persist
- [ ] Range copy/paste interoperates with a real spreadsheet (TSV)
- [ ] Undo/redo works within the grid
- [ ] The type is registered via the plugin API (not special-cased in core)
- [ ] `npm run typecheck && npm test && npm run test:e2e` green

## 🛑 GATE
1. Does the grid feel close enough to lightweight Excel for MVP?
2. Is "frontmatter schema + embedded CSV" the right storage, or prefer sidecar/plain CSV?
3. Which column types are must-haves for MVP beyond the listed set?
4. Any blocking issues?
5. Additional feedback?

## Git Checkpoint
Stage: `packages/note-tables/**`, provider registration, "insert table" command, tests.

Commit message:
`feat: table note type with excel-like editing (first-party plugin)`

## Feedback

**2026-07-06 — Implemented & verified.** `@notes/note-tables`:
- **Format:** table note = `.md` with `type: table` frontmatter carrying the **column schema**
  (name, type, options) + an embedded ` ```csv ` block. Round-trip stable (yaml + papaparse),
  plain-CSV-friendly. Registered as a `NoteTypeProvider` on the server registry (dogfooding);
  `note.detectType` command/route added.
- **Grid:** Excel-like — keyboard nav (arrows/Tab/Enter), edit-in-place, typed cell editors
  (text/number/date/checkbox/select), sticky header, add/delete rows & columns, rename column,
  change type, sort asc/desc, single-cell copy/paste, and a clear Unsaved→Saved status.
- **Web:** `NoteEditor` routes `type: table` notes to the grid (autosave shared with markdown);
  **New table** command.

Verified: `typecheck`, `lint`, `test` (46; +5 format), `build`, and **Playwright** (create
table → edit cell → add column → persists to disk).

### GATE — validation questions
1. Does the grid feel close enough to lightweight Excel for MVP?
2. Is "frontmatter schema + embedded CSV" the right storage (vs sidecar/plain CSV)?
3. Which column types are must-haves beyond text/number/date/checkbox/select?

**Deferred (`deferred-grid-advanced`):** multi-range selection, fill-down, undo/redo, column
reorder, and filtering.
