# Phase 3 — App Shell, Layout, Tabs & Panes

**Status:** ⬜ Not Started
**Depends on:** 1

## Goal

The polished application frame: resizable sidebars, a main area with **tabs and split panes**,
a status bar, ribbon, first-run Tome selection, the client API/WebSocket layer, and the
theming foundation. This is the stage all note types and panels dock into.

## Tasks

### Task: Client API & live-sync layer  `Wave 1`
`apps/web`: typed client for the server command bus + REST routes, and a WebSocket subscriber
that applies `TomeChange`/command events to app state. Central `AppContext` (React Context +
reducer) for Tower session state; encapsulated stores allowed for heavy widgets later.

### Task: Layout shell & theming foundation  `Wave 1`
Resizable left sidebar (explorer), right sidebar (info panels), main area, top ribbon,
bottom status bar. Theming via CSS-variable tokens with **light/dark** switch + system
preference. Build/adopt base `@notes/ui` primitives (Button, Icon, Tooltip, Menu, Modal,
Resizer) for consistency.

### Task: File explorer tree  `Wave 2`
Virtualized folder/file tree from `listTree`. Expand/collapse, select-to-open, context menu
(new note, new folder, rename, move, delete → all via commands), drag-drop move, and live
refresh on watcher events. Show note-type icons.

### Task: Tabs & split panes  `Wave 2`
Main area supporting multiple tabs, drag-to-split (horizontal/vertical) into panes, focus
tracking, and a per-tab view host that renders the correct **view** for a note's type (via
the note-type registry). Persist layout to the Tower session file.

### Task: Command palette & quick switcher (scaffold)  `Wave 2`
`Ctrl/Cmd+P` command palette bound to the command registry and `Ctrl/Cmd+O` quick switcher
(open note by name via index). Full command population/hotkeys are finished in Phase 10; this
establishes the surface and keyboard entry.

### Task: First-run / Tome selection
If no Tome is open, prompt to open or create a Tome (folder); the Tower session records open
Tomes. Persist the choice. Empty-state UI when the Tome has no notes (create-first-note
affordance).

### Task: Tests
Vitest for reducers/client layer; Playwright: open app → see explorer → open a note in a tab
→ split the pane → toggle theme.

## Verification Checklist
- [ ] Sidebars resize; layout persists across reloads
- [ ] Explorer reflects the Tome and updates live on external file changes
- [ ] Notes open in tabs; panes split and route to the correct view by note type
- [ ] Command palette + quick switcher open and are keyboard-drivable
- [ ] First-run Tome selection works; empty states are handled
- [ ] Light/dark theme toggles cleanly with no flash
- [ ] `npm run typecheck && npm test && npm run test:e2e` green

## 🛑 GATE
1. Does the layout/interaction model match your mental model (Obsidian-like docking)?
2. Is React Context + reducer sufficient, or do you want a store (e.g., Zustand) for
   Tower session state now?
3. Should tab/pane layout persist per-Tome in a dotfile, or in the index DB?
4. Any blocking issues?
5. Additional feedback?

## Git Checkpoint
Stage: `apps/web/**` (shell, explorer, tabs, client layer), `packages/ui/**`, tests.

Commit message:
`feat: app shell with explorer, tabs, split panes, and theming`

## Feedback
_(none yet)_
