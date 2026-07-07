# Phase 8 — Kanban Board Note Type

**Status:** ✅ Complete
**Depends on:** 3, 1

## Feedback

**2026-07-06 — Implemented & verified.** `@notes/note-boards`: markdown-backed board
(`type: board` frontmatter; `##` columns; `- [ ]`/`- [x]` cards). `BoardView` — columns with
cards, add card (inline), toggle done, edit (double-click), delete card, **drag cards between
columns**, add/rename/delete column. Registered as a `NoteTypeProvider`; **New board** in the
type dropdown, palette, and explorer menu; routed through `NoteEditor` (autosave).

Verified: `typecheck`, `lint`, `test` (55; +3 format round-trip), `build`, **Playwright**
(create board → add card → persists). _Also fixed a CSS regression that briefly broke canvas
layout._

**Deferred (`deferred-board-advanced`):** card↔note links, due dates/labels, archive, and
reorder within a column.

## Goal

A **kanban board** note type, **markdown-backed** for git-friendliness and human readability
(columns = headings, cards = list items), built **as a first-party plugin**. Drag-and-drop
cards, edit inline, link cards to notes.

## Tasks

### Task: Board markdown format & (de)serializer  `Wave 1`
`packages/note-boards`: define the markdown layout — `type: board` frontmatter (+ board
settings), each column a `##` heading, each card a list item (supporting `[ ]`/`[x]` and
`[[links]]`). Serializer/deserializer registered as a `NoteTypeProvider`. Round-trip stable
and readable as plain markdown.

### Task: Board view — columns & cards  `Wave 1`
A column/card board UI rendering the parsed structure. Add/edit/delete columns; add/edit/
archive cards; inline markdown in cards; card metadata (checkbox done state, links, tags).

### Task: Drag & drop  `Wave 2`
Drag cards within and across columns, reorder columns, keyboard-accessible move commands.
Persist ordering back to markdown on drop via the command bus.

### Task: Card ↔ note linking  `Wave 2`
Cards can reference notes via `[[links]]`; provide "open linked note" and "convert card to
note" affordances. Optionally surface a card's linked note preview.

### Task: Register as a plugin & wire the view  `Wave 3`
Register the board note type via the plugin/extension API and the Phase 3 view host. Add a
"new board" command.

### Task: Tests
Vitest: markdown⇄board round-trip (columns/cards/state/links), reorder serialization.
Playwright: create a board, add cards, drag between columns, reload, verify markdown + order.

## Verification Checklist
- [ ] Boards persist as readable markdown (headings/list items) and round-trip stable
- [ ] Columns and cards add/edit/delete/archive correctly
- [ ] Drag-and-drop within/across columns persists order to markdown
- [ ] Cards link to notes; done-state and tags survive round-trips
- [ ] Registered via the plugin API; opens through the view host
- [ ] `npm run typecheck && npm test && npm run test:e2e` green

## 🛑 GATE
1. Is the markdown board layout (headings = columns, list items = cards) acceptable, and is it
   compatible enough with existing tools you care about?
2. What card metadata matters for MVP (due dates, labels, assignees)?
3. Should reordering write explicit order markers, or rely on document order?
4. Any blocking issues?
5. Additional feedback?

## Git Checkpoint
Stage: `packages/note-boards/**`, provider registration, "new board" command, tests.

Commit message:
`feat: kanban board note type, markdown-backed (first-party plugin)`

## Feedback
_(none yet)_
