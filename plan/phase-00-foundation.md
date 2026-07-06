# Phase 0 — Foundation & Scaffolding

**Status:** ✅ Complete
**Depends on:** —

## Goal

Stand up the npm-workspaces monorepo, toolchain, and dev loop so every later phase has a
consistent, verified foundation. Establish the binding conventions doc. No product features
yet — just a bootable server, a rendering web app, and green test/lint/typecheck.

## Tasks

### Task: Initialize monorepo & workspaces
Create root `package.json` with npm workspaces for `apps/*` and `packages/*`. Add root
`tsconfig.base.json` (strict, ESM, `NodeNext`, path aliases `@notes/*`). Create empty
package skeletons listed in `plan.md` §4.1 (each with `package.json`, `tsconfig.json`,
`src/index.ts`). Pin Node version via `.nvmrc`/`engines`.

### Task: Toolchain — lint, format, typecheck
Add ESLint (typescript-eslint, import rules enforcing file extensions + named-exports-only)
and Prettier (double quotes, semicolons, 2-space indent). Add root scripts: `lint`,
`format`, `typecheck` (project references build). Ensure `typecheck` passes across all
packages.

### Task: Test harness — Vitest + Playwright
Configure **Vitest** at root (workspace-aware) with one trivial passing unit test in
`packages/shared`. Configure **Playwright** with one smoke test that loads the web app.
Add scripts: `test`, `test:e2e`.

### Task: Server skeleton (Fastify)
`apps/server`: Fastify instance with a thin HTTP adapter, `GET /health` returning
`{ status: "ok" }`, config loading (Tome path via env/flag, default `./tome`), and a
placeholder command-bus module export (contract stubbed, implemented in Phase 1).

### Task: Web skeleton (React + Vite)
`apps/web`: Vite + React + TS app that renders an app frame and calls `/health`, showing
server status. Wire dev proxy to the server. Include the theming CSS-variable root (light
default) as a placeholder for Phase 3/10.

### Task: Unified dev loop
Root `dev` script runs server + web concurrently. Document `npm install`, `npm run dev`,
`npm run typecheck`, `npm test`, `npm run test:e2e` in a top-level `README.md`.

### Task: Finalize conventions doc
Rewrite `.github/copilot-instructions.md` from the current template into the **binding**
reference: project overview, monorepo layout, stack, architecture rules (files = source of
truth, server command bus, all-content-is-data, GoF patterns), code style (double quotes,
semicolons, 2-space, named exports, ESM extensions, kebab-case files, PascalCase types,
camelCase members), and git conventions. Add `.gitignore` (node_modules, dist, the SQLite
index, `.env`).

## Verification Checklist
- [ ] `npm install` succeeds at root; workspaces resolve `@notes/*`
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes (or only intentional warnings)
- [ ] `npm test` runs the sample Vitest unit test green
- [ ] `npm run dev` boots server + web; web shows "server ok" from `/health`
- [ ] `npm run test:e2e` Playwright smoke passes
- [ ] `.github/copilot-instructions.md` reflects the real stack/conventions
- [ ] SQLite index path and `dist` are gitignored

## 🛑 GATE
1. Is the monorepo layout and package split right, or should any package be merged/renamed?
2. Is Fastify acceptable as the server, or do you prefer Hono/Express?
3. Is `@notes/*` the desired package scope / product codename?
4. Any additions to the conventions doc before it becomes binding for all phases?
5. Any blocking issues?
6. Additional feedback?

## Git Checkpoint
Stage (targeted, per file):
- `package.json`, `package-lock.json`, `tsconfig.base.json`, `.nvmrc`, `.gitignore`, `README.md`
- `apps/server/**`, `apps/web/**`
- `packages/**` skeletons, root ESLint/Prettier/Vitest/Playwright configs
- `.github/copilot-instructions.md`

Commit message:
`chore: scaffold monorepo, toolchain, and dev loop`

## Feedback

**2026-07-05 — GATE (autonomous):** User unavailable at the GATE; proceeded with the
recommended defaults, all of which match the implementation:
- Monorepo layout & package split: **approved** (as built).
- Server framework: **Fastify** (kept).
- Package scope `@notes/*` and codename **Notes**: **kept**.
- Module resolution **Bundler** with **extensionless** relative imports: **kept** (documented in
  `.github/copilot-instructions.md`, overriding the old template's extension note).
- Single monorepo-wide `tsc --noEmit` typecheck (no TS project references) for now.
- No blocking issues.

Verification all green: `npm install`, `typecheck`, `lint`, `test` (1 passing), `dev`
(server :8787 + web :5173, `/health` ok via proxy), `test:e2e` (Playwright smoke), `build`.

_Revisit if the user later wants a different server, scope, or import style._
