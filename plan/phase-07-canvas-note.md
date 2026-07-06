# Phase 7 — Canvas Note Type (JSONCanvas)

**Status:** ⬜ Not Started
**Depends on:** 3, 1

## Goal

An infinite **canvas** note type using the open **JSONCanvas** (`.canvas`) format, built **as
a first-party plugin**. Pan/zoom, nodes (text, note-embed, link, group), and edges — enough
for spatial thinking, formatted for Obsidian interop.

## Tasks

### Task: JSONCanvas format & (de)serializer  `Wave 1`
`packages/note-canvas`: read/write the JSONCanvas spec — nodes (`text`, `file`, `link`,
`group`) and `edges` with positions/sizes/colors. Register a `NoteTypeProvider` for
`*.canvas`. Ensure round-trip fidelity with the spec.

### Task: Infinite canvas surface  `Wave 1`
A pan/zoom canvas (custom or a lib such as React Flow) with a coordinate system matching
JSONCanvas. Smooth zoom, pan, grid/snap, and selection. Persist viewport per note.

### Task: Nodes — create, move, resize, edit  `Wave 2`
Create nodes from a toolbar/context menu; drag to move, handles to resize; edit **text**
nodes inline (markdown); **file/note-embed** nodes render the referenced note (read-only or
mini-editor); **link** nodes for URLs. **Group** nodes contain/label others (Composite).

### Task: Edges & connections  `Wave 2`
Draw edges between node anchors, with direction/arrowheads, labels, and color. Reconnect and
delete. Serialize to JSONCanvas edges.

### Task: Register as a plugin & wire the view  `Wave 3`
Register the canvas note type via the plugin/extension API and the Phase 3 view host. Add a
"new canvas" command. Clicking a note-embed can open the underlying note in a tab.

### Task: Tests
Vitest: JSONCanvas round-trip (nodes/edges/groups), geometry serialization. Playwright: create
a canvas, add two text nodes, connect them, reload, verify persistence.

## Verification Checklist
- [ ] `.canvas` files read/write valid JSONCanvas; round-trip is faithful
- [ ] Pan/zoom is smooth; viewport persists
- [ ] Nodes create/move/resize/edit; note-embed renders the target note
- [ ] Groups contain and move their children (Composite)
- [ ] Edges connect, label, and serialize correctly
- [ ] Registered via the plugin API; opens through the view host
- [ ] `npm run typecheck && npm test && npm run test:e2e` green

## 🛑 GATE
1. Is JSONCanvas fidelity important enough to keep strict Obsidian interop, or can we extend it?
2. Custom canvas vs a library (e.g., React Flow) — any preference given polish/perf goals?
3. Should note-embed nodes be editable inline or read-only previews for MVP?
4. Any blocking issues?
5. Additional feedback?

## Git Checkpoint
Stage: `packages/note-canvas/**`, provider registration, "new canvas" command, tests.

Commit message:
`feat: canvas note type with jsoncanvas format (first-party plugin)`

## Feedback
_(none yet)_
