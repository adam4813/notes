# Phase 16 — Canvas Inline Editing (Papers on Desk)

**Status:** ✅ Complete
**Depends on:** 15

## Goal

Turn the canvas into a true **spatial editor** — notes can be arranged like papers on a
desk and edited in-place with zero friction. Double-clicking a `FileNode` card activates
a full `MarkdownEditor` inside the node. Clicking elsewhere saves and returns to preview.

⚠️ **Scope note:** This is the most ambitious canvas phase. The primary complexity is
managing the interaction boundary between the canvas (pan, drag, select) and the embedded
editor (pointer events, keyboard shortcuts, focus). A **fallback design** is specified in
case inline editing proves too fragile: double-click opens the note in a side panel
pinned to the canvas view. The side-panel fallback still delivers the "papers on desk"
layout experience while deferring the interaction-boundary complexity.

## Tasks

### Task: Edit-mode state for FileNode  `Wave 1`
- Add `editingNodeId: string | null` to `CanvasView` state (default `null`).
- Double-click a `FileNode` → `setEditingNodeId(node.id)`.
- Escape key anywhere → save + `setEditingNodeId(null)`.
- Pointer-down on canvas background or a different node → save + `setEditingNodeId(null)`.
- While `editingNodeId !== null`:
  - Canvas pan on pointer-drag is **disabled** (guard in `onPointerDown`).
  - Canvas node move is **disabled** for the editing node.
  - The editing node receives `pointer-events: all`; other nodes get reduced opacity
    (`opacity: 0.5`) as a visual focus cue.

### Task: Full editor inside the FileNode card  `Wave 2`
- When `node.id === editingNodeId`:
  - Mount a full `MarkdownEditor` in the node body area:
    - Mode: `"rendered"` (WYSIWYG) by default for low-friction editing.
    - The editor's `value` is loaded from the file (already fetched for preview).
    - `onChange` calls `PUT /api/file` (debounced 500 ms) — same save path as the
      main editor.
  - The node title bar remains visible above the editor area (draggable — allows
    repositioning the note while editing by dragging the title bar only).
  - Toolbar appears at the top of the editor area (bold, italic, links, etc.).
- When `node.id !== editingNodeId`:
  - Unmount the editor; show the rendered preview from Phase 15.
  - The saved content is immediately reflected in the preview.
- **Only one** `MarkdownEditor` instance exists at a time (the currently-editing node).
  All others are lightweight preview renders.

### Task: Keyboard interaction boundary  `Wave 2`
- When editor is focused: all standard editor shortcuts (Ctrl+B, Ctrl+S, arrows, Tab,
  Enter) go to the editor — do NOT let the canvas intercept them.
- When canvas is focused (no node editing): canvas shortcuts work (Delete node, arrow
  nudge, Ctrl+Z undo, etc.).
- `Ctrl+S` inside the editor forces an immediate save (bypasses debounce).
- `Escape` inside the editor: if autocomplete/popover is open, close it; otherwise exit
  edit mode (standard progressive-escape pattern).

### Task: Performance — lightweight preview for non-editing nodes  `Wave 2`
- Preview render (non-editing `FileNode`): use `dangerouslySetInnerHTML` with pre-rendered
  HTML (computed once when content loads, re-computed on `file.changed`). No TipTap
  instance per preview node.
- Viewport culling: `FileNode` components that are entirely outside the canvas viewport
  render a blank placeholder (no content fetch, no HTML render). Add a `useIsVisible`
  check based on world coordinates + current viewport.
- Measure: 10+ FileNodes on canvas should maintain 60 fps during pan/zoom.

### Task: Fallback — side-panel edit mode  `Wave 3` (contingency)
If Tasks 1–3 reveal insurmountable interaction conflicts (e.g., Safari pointer-events
bugs, CodeMirror conflicting with canvas drag), implement the fallback:
- Double-click `FileNode` → splits the current pane: canvas on the left, the note's
  full editor on the right (or bottom on narrow viewports).
- Canvas highlights the active note's card with a colored border.
- Closing the split returns to full-canvas view.
- This delivers spatial layout + editing without requiring a nested editor.

## Verification Checklist
- [ ] Double-click a FileNode → full editor activates inline
- [ ] Title bar remains draggable while editor is open (can reposition note)
- [ ] Clicking canvas background → saves and exits edit mode
- [ ] Canvas pan is disabled while a node is being edited
- [ ] Escape exits edit mode (with progressive escape for autocomplete)
- [ ] Ctrl+S forces immediate save
- [ ] 10+ FileNodes on canvas maintains smooth 60 fps pan/zoom
- [ ] Viewport culling: off-screen nodes do not fetch/render content
- [ ] Toolbar is visible and functional inside the editing node
- [ ] `npm run typecheck && npm test` green

## 🛑 GATE
1. Does editing inline feel like "0 friction papers on a desk"? Or did you hit the
   fallback side-panel path?
2. Is the interaction boundary (editor vs. canvas controls) intuitive and bug-free?
3. Is performance acceptable with many FileNodes?
4. Should the editing node auto-scroll its content, or should we constrain to node size?
5. Any blocking issues?

## Git Checkpoint
```
feat: canvas inline editing — double-click FileNode to edit in place

- editingNodeId state: one node in edit mode at a time
- Full MarkdownEditor mounts inside the node; others stay as lightweight previews
- Canvas pan/move disabled while editing; Escape/click-outside saves + exits
- Keyboard boundary: editor shortcuts captured; canvas shortcuts inactive during edit
- Viewport culling: off-screen FileNodes skip content fetch/render

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Files to stage:
- `packages/note-canvas/src/canvas-view.tsx`
- `apps/web/src/styles.css` (editing-mode styles)

## Feedback

**Date:** 2026-07-08
**Result:** ✅ GATE passed

- Inline editing: **Yes — feels great, papers on a desk**
- Interaction boundary: **Great — natural and bug-free**
- No blocking issues
- Scroll preference: "Both — auto-size on embed to fit content (with max size), user can resize after"
  → Deferred: auto-size FileNode to content on first embed drop
- Follow-up cleanup: dropped canvas FileNodes now auto-size from the embedded note content on first drop.
