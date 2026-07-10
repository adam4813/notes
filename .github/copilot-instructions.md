# Copilot Instructions — Notes

Binding stack, architecture, and code-style reference for this repository. All phases must
follow this document. See [`plan.md`](../plan.md) and [`plan/`](../plan) for the roadmap.

## Project Overview

**Notes** (working name) is a local-first, git-friendly, Obsidian-inspired knowledge tool
with a friendly editor and first-class **table / canvas / board** note types, extensible via
**plugins** from day one.

- **Files on disk are the source of truth.** Everything is a plain, git-committable file.
- **SQLite is a rebuildable index** (search / links / tags), never the source of truth.
- **Container model:** a **Tome** is one folder of notes (the git unit); a **Tower** is a
  local session that opens one or more Tomes (MVP: a single active Tome, multi future-proofed).

## Stack

- **Language:** TypeScript (strict), ESM, Node `>= 20` (pinned to 24 via `.nvmrc`).
- **Frontend:** React 18 + Vite (`apps/web`).
- **Backend:** Fastify (`apps/server`) — a thin HTTP/WS adapter over a **command bus**.
- **Database:** SQLite via `better-sqlite3` (added in Phase 2), gitignored.
- **Monorepo:** npm workspaces, scope `@notes/*` (`apps/*` + `packages/*`).
- **Tests:** Vitest (unit/integration), Playwright (e2e). **Lint/format:** ESLint + Prettier.

## Monorepo Layout

```
apps/server    Fastify host: HTTP/WS adapter, command bus, plugin host (server half), Tower session
apps/web       React + Vite UI shell
packages/
  shared       Types, zod schemas, constants, and centralized UI strings/terms
  core         Command bus, event bus, registries, extension-point contracts (NO I/O)
  tome         File-system Tome: CRUD, path safety, atomic writes, watcher
  index        SQLite index: links, tags, frontmatter, FTS5 search
  editor       Markdown editor: modes, toolbar, list/checkbox behavior, markdown round-trip
  note-tables  Table note type (first-party plugin)
  note-canvas  Canvas note type, JSONCanvas (first-party plugin)
  note-boards  Kanban board note type, markdown-backed (first-party plugin)
  plugin-host  Plugin manifest, lifecycle, local loader (client + server halves)
  ui           Shared design-system components, theming tokens, icons
```

## Architecture Rules

1. **Files are the source of truth.** Never treat the SQLite index as authoritative; it must
   be droppable and fully rebuildable from files.
2. **All mutations flow through the server command bus** (Command pattern). Do not perform
   direct file writes from routes or UI — dispatch a command.
3. **`packages/core` is pure — no I/O.** File system, DB, and network live in `tome`, `index`,
   and `apps/server`. Keep `core` free of runtime side effects.
4. **All content and config is data**, never hardcoded: notes/tables/boards/canvas are files;
   settings, hotkeys, and plugin config are persisted data and editable in-app.
5. **Note types and features register through the same extension API a plugin uses** — the
   first-party table/canvas/board types are plugins. No special-casing in core.
6. **Future-proof, don't build:** keep multiplayer/auth/multi-Tome/desktop-wrapper structurally
   viable (thread request context, decouple server/UI) but out of scope for MVP.

### Gang-of-Four patterns to prefer

- **Factory** — note-type instantiation from a file.
- **Strategy** — per-note-type renderers/editors/serializers.
- **Command** — every mutation is a command on the bus.
- **Chain of Responsibility** — command middleware pipeline (validate → plugins → handler →
  persist → emit).
- **Observer** — the event bus (file changes, index updates, UI refresh).
- **Composite** — canvas nodes / nested board structure.
- **Registry** — extension points collect provider registrations.

## Code Style

- **Double quotes, semicolons, 2-space indent** (enforced by Prettier).
- **Named exports only** — no default exports (except framework config entrypoints such as
  `vite.config.ts`, `playwright.config.ts`, `eslint.config.js`). Enforced by ESLint
  (`import/no-default-export`).
- **File names:** `kebab-case` (e.g., `command-bus.ts`). **Types/interfaces:** `PascalCase`.
  **Variables/members/functions:** `camelCase`. **Constants:** `UPPER_SNAKE_CASE` where apt.
- **Modules:** ESM. Module resolution is `Bundler`, so **relative imports are extensionless**
  (`./config`, not `./config.js`). Cross-package imports use the package name (`@notes/shared`).
- **Functional React components**; hooks for state. Global app state via **React Context +
  reducers**; heavy widgets (editor, canvas, table) may own encapsulated local stores.
- **Strict TypeScript** — no implicit `any`, handle `null`/`undefined`, keep functions typed.
- **Desktop-safe interactions only** — never use `window.prompt` dialogs (they fail in desktop).
  Use in-app modal/popover UI components for user input instead.
- Comment only where intent isn't obvious; prefer clear names over narration.

## Testing & Verification

- Run `npm run typecheck && npm test` after each task; fix errors before moving on.
- Add Vitest unit tests for logic (`*.test.ts` beside the code) and Playwright specs in `e2e/`.
- First e2e run needs browsers: `npx playwright install chromium`.

## Git Conventions

- **Conventional commits:** `feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`.
- **Targeted commits only** — never `git add -A`. Stage specific files/hunks and verify with
  `git diff --cached --stat` before committing.
- Every commit includes the trailer:
  ```
  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
  ```
