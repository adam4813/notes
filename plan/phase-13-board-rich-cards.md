# Phase 13 — Board Rich Cards

**Status:** 🔄 In Progress
**Depends on:** 0–12

## Goal

Upgrade kanban board cards from plain text list-items to **full notes**: each card has
YAML frontmatter (title, column, done, due, labels, priority) plus a rich markdown body
edited inline in the board. Cards live in a hidden dot-folder beside the board file so they
are never exposed in the explorer or made directly linkable, yet their content is indexed
for full-text search.

## Architecture

```
My Board.md                      ← column layout + ordered card-ID arrays
.My Board.cards/                 ← hidden dot-folder (not shown in explorer)
  card-m5x3a1b2.md               ← full note (frontmatter + body)
  card-n7y4c2d3.md
```

**`My Board.md` (new format):**
```markdown
---
type: board
columns:
  - name: Todo
    cards: [card-m5x3a1b2, card-n7y4c2d3]
  - name: Doing
    cards: []
  - name: Done
    cards: [card-p8z5e3f4]
---
```

**`card-m5x3a1b2.md`:**
```markdown
---
title: First Task
column: Todo
done: false
due: 2026-07-15
labels: [bug, urgent]
priority: high
---

This is the **card body** with full markdown support.
```

Card filenames use a random hash (`card-${timestamp36}-${counter}`) to discourage
hand-editing. The dot-folder prefix keeps it off the explorer. FTS indexes the body; the
wikilink autocomplete does NOT surface card files.

## Tasks

### Task: Extend card model & CardStore  `Wave 1`
- Add `RichCard` interface to `packages/note-boards/src/board-format.ts`:
  ```ts
  export interface RichCard {
    id: string;        // hash (filename without extension)
    title: string;
    column: string;
    done: boolean;
    due?: string;      // YYYY-MM-DD
    labels?: string[];
    priority?: "low" | "medium" | "high";
    body: string;      // raw markdown (after frontmatter)
  }
  ```
- Change `BoardColumn.cards` from `BoardCard[]` to `string[]` (card IDs).
- Create `packages/note-boards/src/card-store.ts`:
  - `dotFolderPath(boardPath: string): string` — `path.join(dir, '.' + basename + '.cards')`
  - `cardPath(boardPath: string, cardId: string): string`
  - `readCard(boardPath, cardId, fs): Promise<RichCard>`
  - `writeCard(boardPath, card, fs): Promise<void>` — YAML frontmatter + body
  - `deleteCard(boardPath, cardId, fs): Promise<void>`
  - `listCards(boardPath, fs): Promise<RichCard[]>`
- Update `parseBoard` / `serializeBoard` for new YAML column format.
- Keep `newCardId()` generating `card-${Date.now().toString(36)}-${counter}`.

### Task: Auto-migrate old board format  `Wave 1`
- In `parseBoard`: detect old format (lines with `##` headings + `- [ ]` cards).
- If old format: create `RichCard` stubs from list items (title = text, body = ""), return
  a `BoardMigration` signal along with the parsed model so the server can write out card
  files and rewrite the board file on the next save.
- Migration is idempotent: running it twice on an already-migrated file is a no-op.

### Task: Server commands for card CRUD  `Wave 1`
Create `apps/server/src/commands/card-commands.ts` and register in `routes.ts`:

- `POST /api/cards/create` — `{ boardPath, column }` → create card file, update board columns,
  return `RichCard`
- `POST /api/cards/update` — `{ boardPath, card: RichCard }` → write card file + update
  column order if title changed
- `POST /api/cards/delete` — `{ boardPath, cardId }` → delete card file, remove from board
- `POST /api/cards/move`   — `{ boardPath, cardId, toColumn, toIndex }` → move card
- `GET  /api/cards/list`   — `{ boardPath }` → list all cards with their `RichCard` data
- `GET  /api/cards/get`    — `{ boardPath, cardId }` → single card

All commands run through the existing command bus / middleware pipeline.

### Task: Update BoardView for rich cards  `Wave 2`
- Fetch cards via `GET /api/cards/list?boardPath=…` on mount and on board file change.
- Card collapsed view: checkbox (done toggle), title text, label chips, due date badge.
- Click card → **expand inline** (accordion within the column):
  - Editable title input
  - Label multi-select, due date `<input type="date">`, priority select
  - Full `MarkdownEditor` for the body (rendered mode by default)
  - Auto-save on change (debounced 800 ms)
  - Collapse button / click-outside collapses
- Add card: "+ Add card" button at column bottom → calls `create`; focuses new card.
- Delete card: trash icon inside expanded card.
- Drag-to-reorder cards within/between columns still works (calls `move`).
- Remove old inline-text editing that directly mutated the markdown.

### Task: Index — FTS card bodies; exclude from wikilink autocomplete  `Wave 2`
- In `packages/index/src`: when scanning a tome, also walk `.*. cards/` and `.*.events/`
  dot-folders (read-only; never write to them from the indexer).
- Index card files with `linkable: false` metadata column (add column if not present).
- `listNotes()` used by wikilink autocomplete: add `WHERE linkable != 0 OR linkable IS NULL`.
- Search endpoint (`/api/search`): results CAN include card files (don't filter them out).
- Explorer file listing: already excludes dot-prefix folders; verify this holds.

## Verification Checklist
- [ ] Old board files auto-migrate: list-item cards become card files in the dot-folder
- [ ] New board is created with the YAML column format
- [ ] Card expansion shows editable title, labels, due, priority, and markdown body
- [ ] Card body auto-saves; changes round-trip to disk correctly
- [ ] Cards move between columns via drag-and-drop (calls move command)
- [ ] Deleting a card removes the file and updates the board
- [ ] Card content appears in full-text search results
- [ ] Card files do NOT appear in wikilink autocomplete dropdown
- [ ] `.*.cards/` folder does NOT appear in the explorer tree
- [ ] `npm run typecheck && npm test` green

## 🛑 GATE
1. Does editing a card feel natural? Is the expand/collapse flow intuitive?
2. Does migration preserve all existing cards from old boards?
3. Any fields missing from the card frontmatter (labels, priority, due)?
4. Any blocking issues?

## Git Checkpoint
```
feat: rich board cards — dotfolder card files with full markdown body

- RichCard model + CardStore (read/write/delete card .md files)
- New board format: YAML column+card-ID layout; auto-migrate old list format
- Server CRUD commands: CreateCard, UpdateCard, DeleteCard, MoveCard
- BoardView: click-to-expand inline editor (labels, due, priority, body)
- Index: FTS card bodies; exclude cards from wikilink autocomplete

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Files to stage:
- `packages/note-boards/src/board-format.ts`
- `packages/note-boards/src/card-store.ts` (new)
- `packages/note-boards/src/board-view.tsx`
- `packages/note-boards/src/index.ts`
- `apps/server/src/commands/card-commands.ts` (new)
- `apps/server/src/routes.ts`
- `packages/index/src/` (indexer changes)

## Feedback
_(recorded after GATE)_
