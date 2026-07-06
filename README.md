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
              note-boards, plugin-host, ui
```

## Conventions

See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for the binding stack,
architecture, and code-style conventions.
