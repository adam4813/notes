# Notes App — Implementation Plan

> Codename: **Notes** (working name; rename freely). A local-first, git-friendly,
> Obsidian-inspired knowledge tool with an unusually friendly editor, first-class
> table / canvas / board note types, and a plugin system baked in from day one.

---

## 1. Problem & Approach

Build an Obsidian-like notes app that is **more user friendly to edit**, ships as an
**extremely polished MVP** with a lean-but-complete core feature set, and is
**architected to extend** (plugins, note types) without rework.

**Approach — spec-driven, phase-by-phase.** Each phase is a self-contained spec file in
[`plan/`](plan/) with concrete tasks, a verification checklist, a human **GATE**, and a
git checkpoint. Phases are implemented one at a time via the `implement-phase` skill.
Independent phases can be run in parallel (see [§7 Waves](#7-parallelization--waves)).

**First pass runtime:** local file system + Node server + browser UI. A desktop wrapper
is deferred and kept **wrapper-agnostic** so Electron/Tauri can be added later with no
core changes.

---

## 2. Product Vision & MVP Scope

**Source of truth = files on disk.** Everything is a plain file that can be committed to
git and edited on desktop (local) or web (remote). The SQLite database is a **rebuildable
index** (search / links / tags), never the source of truth.

**Container model — Tower ▸ Tome.** A **Tome** is a single folder of notes/files and is the
**git/source-control unit** (the "vault-equivalent"). A **Tower** is your local, non-committed
session that can reference one or more Tomes plus your layout. MVP ships a **single active
Tome**; the Tower is modeled to hold multiple Tomes later (future-proofed, not built). All
user-facing terms live in a central strings file so the naming theme is re-skinnable.

**MVP core features (all must ship, high polish):**

- Tome file/folder **explorer**
- **Markdown editor** with **Edit / Split / Rendered** modes, a toggleable rich **toolbar**,
  editing directly in rendered mode, and natural lists/checkboxes (Tab / Shift+Tab
  indent anywhere on the line)
- **Wikilinks** `[[…]]` with autocomplete + **backlinks** panel
- **Tags** `#tag` with a tag pane
- **Full-text search** (SQLite FTS5)
- **Table / lightweight-database** note type (Excel-like editing)
- **Canvas** note type (infinite canvas, JSONCanvas format)
- **Kanban board** note type (markdown-backed)
- **Command palette** + quick switcher
- **Tabs & split panes**
- **Themes** (light/dark + theming system)
- **Plugin system** (real extension points; canvas/boards/tables are first-party plugins)
- **YAML frontmatter / properties**

**Out of MVP (structurally future-proofed, not built):** graph view, daily notes/templates,
real-time collaboration, multi-user accounts, auth, hosted remote sync, desktop wrapper,
third-party plugin marketplace/sandboxing. Sync between local and remote is done by the
user via **git** (the app only guarantees git-friendly formats).

---

## 3. Key Decisions (locked from planning Q&A)

| Area | Decision |
|------|----------|
| Source of truth | Files on disk; SQLite is a rebuildable **index** (gitignored) |
| Database | **SQLite** via `better-sqlite3` (embedded, synchronous) |
| Frontend | **React + TypeScript + Vite** |
| Backend | **Fastify** behind a thin, swappable HTTP adapter; the real server contract is a **command bus** that plugins hook into |
| Monorepo | **npm workspaces** — `apps/*` + `packages/*`, scope `@notes/*` |
| Container model | **Tower ▸ Tome**: a Tome is one committable folder (git unit); a Tower is a local session referencing one or more Tomes. MVP = single Tome, multi future-proofed; user-facing terms centralized for re-skinning |
| Editor | Hybrid: **ProseMirror/TipTap** for rendered/WYSIWYG editing + **CodeMirror 6** for source; markdown round-trip kept clean for git |
| Global state | **React Context + reducers**; heavy widgets (editor, canvas, table) own encapsulated local stores inside their packages |
| Desktop wrapper | **Wrapper-agnostic**; decided later |
| Obsidian compat | **Format-compatible** (YAML frontmatter, `[[wikilinks]]`, JSONCanvas) — not a drop-in |
| Canvas format | **JSONCanvas** (`.canvas`) |
| Board format | **Markdown-backed** kanban (columns = headings, cards = list items) |
| Table format | **Markdown file**: `type: table` frontmatter carries the **column schema**; body holds an **embedded CSV** block. Single git-friendly file; plain-CSV import/export for migration |
| Git | **Git-friendly formats only** for MVP; user runs git themselves |
| Plugins | **Dogfood-local**: define extension points, build canvas/boards/tables *as* first-party plugins, load local trusted plugins in-process (sandboxing later) |
| Quality tooling | **Vitest** (unit/integration), **Playwright** (e2e), **ESLint + Prettier** |

---

## 4. Architecture Overview

### 4.1 Monorepo layout

```
apps/
  server/        # Fastify host: HTTP/WS adapter, command bus, plugin host (server half), Tower session
  web/           # React + Vite UI shell
packages/
  shared/        # types, schemas (zod), constants shared client+server
  core/          # command bus, event bus, note-type registry, extension-point contracts
  tome/          # file-system Tome (git-unit folder): CRUD, path safety, atomic writes, watcher
  index/         # SQLite indexer + search (FTS5), links, tags, frontmatter
  editor/        # markdown editor: modes, toolbar, list/checkbox behavior, md round-trip
  note-tables/   # table note type (first-party plugin)
  note-canvas/   # canvas note type (first-party plugin, JSONCanvas)
  note-boards/   # kanban note type (first-party plugin)
  plugin-host/   # plugin manifest, lifecycle, loader (client + server halves)
  ui/            # shared design-system components, theming, icons
```

### 4.2 Data flow

```
UI (React)  --command-->  Server command bus  --middleware/plugins-->  Tome (files)
                                     |                                      |
                                     |                                 file watcher
                                     v                                      v
                              SQLite index  <----- incremental reindex -----+
UI  <--- WebSocket live updates (file changed, index updated, command result) ---
```

- **All mutations flow through the server command bus** (Command pattern). Plugins register
  commands and middleware here so behavior is extensible without core edits.
- The **watcher** keeps the index in sync even when files change on disk (git pull, external
  editor), and pushes live updates to the UI.

### 4.3 Note types & on-disk formats

| Note type | File | Format |
|-----------|------|--------|
| Markdown  | `*.md` | CommonMark + YAML frontmatter, `[[wikilinks]]`, `#tags` |
| Table     | `*.md` (`type: table`) | Frontmatter schema (columns + types) + embedded CSV block |
| Canvas    | `*.canvas` | JSONCanvas (nodes: text/file/link/group; edges) |
| Board     | `*.md` (`type: board`) | Columns = `##` headings, cards = list items / checkboxes |

Note types are resolved by a **registry** (Factory + Strategy). Each MVP note type is
registered through the **same extension API a plugin uses** — proving the plugin system.

### 4.4 Extension model & GoF patterns

Extension points (defined in `packages/core`, surfaced by `plugin-host`):
note-type providers, commands, ribbon/toolbar items, side-panel views, settings tabs,
editor extensions, server hooks/handlers, and an event bus.

- **Factory** — note-type instantiation from a file
- **Strategy** — per-note-type renderers/editors/serializers
- **Command** — every mutation is a command routed through the bus
- **Chain of Responsibility** — command middleware pipeline (validation, plugins, persistence)
- **Observer** — event bus for cross-cutting reactions (reindex, UI refresh)
- **Composite** — canvas nodes / nested board structure
- **Registry** — extension points collect provider registrations

All content and configuration is **data** (files / SQLite / JSON), never hardcoded, and is
editable in-app (schema editors, settings UI) per project conventions.

---

## 5. Non-Goals (future-proofing notes)

Kept structurally viable but explicitly **not built** in MVP:

- **Multiplayer / real-time collab** — command bus + document model are compatible with a
  future CRDT/OT layer; no networking or presence built now.
- **Multi-user / auth / hosted sync** — server is single-local-user; keep request context
  threaded so an auth/user dimension can be added later.
- **Desktop wrapper** — server and UI are decoupled over HTTP/WS so Electron or Tauri can
  wrap them unchanged.
- **Graph view** — the index already stores the link graph; only the visualization is
  deferred.
- **Multi-Tome Towers** — the Tower session is modeled to reference multiple Tomes, but MVP
  opens a single Tome; multi-Tome switching/UI is deferred.

---

## 6. Implementation Progress

Status legend: ⬜ Not Started · 🔄 In Progress · ✅ Complete

| Phase | Detail File | Status | Depends on |
|-------|-------------|--------|------------|
| 0. Foundation & Scaffolding | [plan/phase-00-foundation.md](plan/phase-00-foundation.md) | ✅ Complete | — |
| 1. Tome, FS & Command/Extension Core | [plan/phase-01-tome-core.md](plan/phase-01-tome-core.md) | ✅ Complete | 0 |
| 2. SQLite Index & Search Engine | [plan/phase-02-index-search.md](plan/phase-02-index-search.md) | ✅ Complete | 1 |
| 3. App Shell, Layout, Tabs & Panes | [plan/phase-03-app-shell.md](plan/phase-03-app-shell.md) | ✅ Complete | 1 |
| 4. Markdown Editor — Modes & Round-trip | [plan/phase-04-editor-core.md](plan/phase-04-editor-core.md) | ✅ Complete | 3 |
| 5. Rich Editing UX, Links & Backlinks | [plan/phase-05-editing-ux-links.md](plan/phase-05-editing-ux-links.md) | ✅ Complete | 4, 2 |
| 6. Table (Lightweight DB) Note Type | [plan/phase-06-table-note.md](plan/phase-06-table-note.md) | ⬜ Not Started | 3, 1 |
| 7. Canvas Note Type (JSONCanvas) | [plan/phase-07-canvas-note.md](plan/phase-07-canvas-note.md) | ⬜ Not Started | 3, 1 |
| 8. Kanban Board Note Type | [plan/phase-08-board-note.md](plan/phase-08-board-note.md) | ⬜ Not Started | 3, 1 |
| 9. Plugin System Hardening & Loading | [plan/phase-09-plugin-system.md](plan/phase-09-plugin-system.md) | ⬜ Not Started | 6, 7, 8 |
| 10. Command Palette, Hotkeys & Theming | [plan/phase-10-commands-theming.md](plan/phase-10-commands-theming.md) | ⬜ Not Started | 3, 5 |
| 11. Search, Tags & Info Panels UI | [plan/phase-11-search-tags-ui.md](plan/phase-11-search-tags-ui.md) | ⬜ Not Started | 2, 3, 5 |
| 12. MVP Polish, Performance & Hardening | [plan/phase-12-polish.md](plan/phase-12-polish.md) | ⬜ Not Started | 4–11 |

---

## 7. Parallelization / Waves

Independent phases can be implemented concurrently (one agent per phase):

- **Wave A:** Phase 0
- **Wave B:** Phase 1
- **Wave C:** Phase 2 ‖ Phase 3
- **Wave D:** Phase 4 ‖ Phase 6 ‖ Phase 7 ‖ Phase 8
- **Wave E:** Phase 5 ‖ Phase 9
- **Wave F:** Phase 10 ‖ Phase 11
- **Wave G:** Phase 12

Within a phase, `### Task` items may carry `Wave N` annotations for intra-phase parallelism.

---

## 8. Cross-Session Handoff

- **Last session:** 2026-07-06 — **Phases 1–5 complete.** Split-menu feedback + the hybrid
  editor (Phase 4) + **rich editing (Phase 5)**: formatting toolbar, `[[` wikilink autocomplete
  + clickable navigation (bracket-escaping fixed), `#` tag autocomplete, and Outline/Backlinks
  panels. 41 unit tests + 5 Playwright specs + build all green.
- **Current state:** Full-featured markdown editing works end-to-end. Editor gate approved; Phase
  5 validation questions recorded (missing-wikilink behavior, toolbar scope).
- **Next action:** **Phase 6 — Table (Lightweight DB) Note Type** (Excel-like grid), or address
  any Phase 5 editor feedback first.
- **Conventions:** `.github/copilot-instructions.md` is finalized in Phase 0; treat it as the
  binding style/architecture reference for all later phases.

---

## 9. Decisions & Tuning History

| Date | Decision / Change | Rationale |
|------|-------------------|-----------|
| Planning | Files = source of truth, SQLite = index | Git-friendly, portable, resilient |
| Planning | Hybrid ProseMirror + CodeMirror editor | Rendered-mode editing + clean markdown diffs |
| Planning | Note types built as first-party plugins | Dogfoods the plugin API, prevents rework |
| Planning | Table note = md frontmatter schema + embedded CSV | Single git-friendly file; easy migration |
