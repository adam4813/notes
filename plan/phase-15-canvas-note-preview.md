# Phase 15 — Canvas Note Cards (Drop + Preview)

**Status:** ✅ Complete
**Depends on:** 7 (Canvas note type)

## Goal

Turn the canvas into a true spatial layout surface for notes. Dragging any `.md` file from
the explorer onto the canvas creates a `FileNode` card that renders the note's content
as a live preview. An open-in-tab button lets users jump to the full editor.

This phase also introduces **embed guards** to prevent boards, calendars, and canvases
from being recursively embedded.

## Tasks

### Task: Drop notes from explorer onto canvas  `Wave 1`
- The canvas container already handles `onDragOver` / `onDrop` for panning.
- Add MIME check: if `event.dataTransfer.types.includes("application/x-notes-path")`:
  1. Convert screen coordinates to world coordinates.
  2. Create a `FileNode` at the drop position:
     ```ts
     const node: FileNode = {
       id: newId("file"),
       type: "file",
       file: droppedPath,   // relative path within the tome
       x: worldX,
       y: worldY,
       width: 320,
       height: 240,
     };
     ```
  3. Commit to canvas data and persist.
- Add a **toolbar button / context-menu item** "Embed note" → opens a note-picker dialog
  (reuse the existing quick-switcher) for users who prefer not to drag.

### Task: Render FileNode as a note card  `Wave 1`
- Fetch note content via `GET /api/file?path=…` (existing endpoint) when a `FileNode`
  mounts.
- Cache the content in component state; re-fetch on the `file.changed` WebSocket event
  for that path.
- Render:
  ```
  ┌──────────────────────────────┐
  │ 📄 Note Title            [⤢] │  title bar (-webkit-app-region: no-drag)
  │──────────────────────────────│
  │ <rendered markdown preview>  │  read-only, scrollable inside the node
  └──────────────────────────────┘
  ```
  - Title bar shows the note's display name (filename without extension, or `title`
    frontmatter if present).
  - `[⤢]` calls `onOpenFile(node.file)` → opens note in a tab.
  - Preview area: rendered HTML from the markdown (use `MarkdownEditor` in view-only
    mode, or a lightweight renderer — prefer the existing `remark`/`rehype` pipeline
    if available; avoid spinning up a TipTap instance per node).
  - Node resize handles remain functional; preview scrolls within the node bounds.
- Loading state: spinner centered in the node.
- Error state (file not found / deleted): grey card with italic "Note not found" + path.

### Task: Embed guard — block note-ception  `Wave 1`
- In the embed resolution layer (where `![[…]]` targets are resolved to rendered content):
  - If the target file's frontmatter has `type: board`, `type: calendar`, or
    `type: canvas` → render as a plain wikilink (no embed), with a tooltip
    "Boards, calendars, and canvases cannot be embedded."
- In `FileNode` rendering: if the file resolves to a canvas file, render as the
  error-state card ("Canvas cannot be embedded in canvas") rather than recursing.
- This prevents note-ception and infinite render loops.

### Task: Verify existing FileNode in format/view  `Wave 2`
- `FileNode` already exists in `canvas-format.ts`. Confirm the canvas view renders it
  (currently it may show as a blank/unstyled box).
- If the view has a `renderNode` switch on `node.type`, add/update the `"file"` case to
  use the new card renderer from Task 2.
- Ensure `onOpenFile` prop is threaded correctly from the note-type registration all the
  way to `CanvasView`.

## Verification Checklist
- [ ] Dragging a `.md` from the explorer onto the canvas creates a FileNode card
- [ ] FileNode shows the note's title and rendered body preview
- [ ] Live update: editing the linked note elsewhere updates the canvas preview within ~1 s
- [ ] `[⤢]` opens the note in a tab
- [ ] Resizing the node scales the preview area (scrolls if content overflows)
- [ ] `![[My Board]]` in a markdown note renders as a plain link, not an embed
- [ ] Dropping a canvas file onto a canvas shows "cannot embed" state
- [ ] "Embed note" toolbar/menu item opens the note picker and inserts a FileNode
- [ ] `npm run typecheck && npm test` green

## 🛑 GATE
1. Does the note preview card look polished on the canvas?
2. Is live update of the preview fast enough to feel connected?
3. Is the embed guard working for boards, calendars, and canvases?
4. Any blocking issues?

## Git Checkpoint
```
feat: canvas note cards — drop notes onto canvas; FileNode preview; embed guards

- Drop .md from explorer → FileNode at drop coordinates (world-space)
- "Embed note" toolbar button opens note-picker dialog
- FileNode renders as a card with title + rendered markdown preview
- Live-update preview via WebSocket file.changed events
- Embed guard: type:board/calendar/canvas files render as plain links (no embed)
- Canvas-in-canvas shows "cannot embed" error card

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Files to stage:
- `packages/note-canvas/src/canvas-view.tsx`
- `packages/note-canvas/src/canvas-format.ts` (if any changes)
- `packages/editor/src/embed-extension.ts` (embed guard)
- `apps/web/src/styles.css` (FileNode card styles)

## Feedback

**Date:** 2026-07-08
**Result:** ✅ GATE passed

- Initial plain-text preview was blocking (user expected rich editor) — resolved by embedding full MarkdownEditor
- Embed guard working correctly
- Editor feel: "OK" — functional, some friction (Phase 16 further refines interaction model)
- No blocking issues
