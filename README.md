# Notes

> Working name **Notes** — a local-first, git-friendly, Obsidian-inspired knowledge tool with
> a friendly editor and first-class table / canvas / board note types, extensible via plugins
> from day one.

Content lives as plain files on disk (the **source of truth**); a rebuildable SQLite database
provides search/link/tag indexing. See [`plan.md`](plan.md) for the full implementation plan
and [`plan/`](plan/) for per-phase specs.

## Container model

- **Tome** — a single folder of notes/files; the unit you commit to git.
- **Tower** — your local session that opens one or more Tomes (MVP: a single active Tome).

## Prerequisites

- Node.js `>= 20` (repo pins Node 24 via `.nvmrc`)
- npm (workspaces)

## Getting started

```bash
npm install          # install workspace dependencies
npm run dev          # start the server (:8787) and web app (:5173) together
```

Open http://localhost:5173 — the app shows the live server status from `/health`.

On first run the explorer offers **✨ Add sample notes** to seed a small showcase Tome
(a welcome note, a table, a board, and a canvas).

## Features (MVP)

- **Friendly editor** — hybrid Markdown editor (WYSIWYG + source + split), autosave,
  `[[wikilink]]` and `#tag` autocomplete, clickable links.
- **First-class note types** — Markdown, **tables**, **kanban boards**, infinite **canvas**
  (JSONCanvas), **Mermaid** diagrams, a **calendar** (month/agenda), and a **grid**
  (tile-map / graph-paper with layers + tokens). Each registers through the same extension API
  a plugin uses.
- **Navigate everything** — command palette, quick switcher (fuzzy, create-on-miss),
  full-text **search** with type/tag/folder filters (hierarchical tags), a **tag** pane,
  **backlinks**, **outline**, and an editable **properties** panel.
- **In-note find & replace** (`Ctrl/Cmd+F`) and **whole-Tome find & replace**.
- **Never lose edits** — deletes are undoable via a toast; edits made **offline** are buffered
  locally and synced automatically on reconnect (with an app-shell service worker).
- **Keyboard-first** — rebindable hotkeys with conflict detection; press the palette command
  **Keyboard shortcuts** (`Ctrl/Cmd+/`) for a cheat sheet.
- **Theming** — light/dark/system plus **Solarized** and **High-contrast** themes, accent
  presets and a custom color picker, adjustable app/editor font sizes, and no flash on load.
- **Layout persists** — open tabs and split panes are restored across reloads.
- **Plugins** — a local, trusted plugin API (commands, status-bar items, active-document,
  settings, theme tokens). See [`docs/plugins.md`](docs/plugins.md).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run server + web concurrently |
| `npm run typecheck` | Type-check the whole monorepo (`tsc --noEmit`) |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |
| `npm test` | Run unit/integration tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |
| `npm run build` | Build the web app |

> First-time e2e run: install browsers with `npx playwright install chromium`.

## Layout

```
apps/server   Fastify host (HTTP/WS, command bus, Tower session)
apps/web      React + Vite UI
packages/*    shared, core, tome, index, editor, note-tables, note-canvas,
              note-boards, note-mermaid, note-calendar, note-grid, plugin-host, ui
```

## Conventions

See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for the binding stack,
architecture, and code-style conventions.

## Known limitations & deferred (post-MVP)

The MVP is intentionally scoped. Structurally viable but **not** built yet:

- **Embeddable note-type widgets** — embedding a table/canvas/calendar/grid *inside* a Markdown
  note (transclusion). The note-type registry is the seam; the editor/markdown round-trip work
  is deferred.
- **Graph view** — the link/tag data is indexed and ready, but there's no visual graph.
- **Collaboration / multiplayer** — the server threads request context and the UI is decoupled
  to keep this viable, but real-time collab and auth are out of scope.
- **Desktop wrapper** — runs locally via Node today; a desktop shell (e.g. Tauri/Electron) is
  future work. Files-on-disk already enable local + committed-to-git workflows.
- **Performance at extreme scale** — results are capped and the file list memoized; full
  virtualization of the explorer/search/large grids is deferred.
- **Per-Tome plugin loading** — plugins are bundled and enabled globally today.
- **Advanced note-type features** — e.g. board card metadata, canvas groups/edge labels, grid
  range-select / fill / undo.
