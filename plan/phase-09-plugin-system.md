# Phase 9 — Plugin System Hardening & Loading

**Status:** ⬜ Not Started
**Depends on:** 6, 7, 8

## Goal

Promote the internal extension points into a **clean, documented plugin API** and load
**local trusted plugins**. Since canvas/boards/tables were built *on* this API, this phase
formalizes the contract, adds lifecycle + settings, ships a sample third-party plugin, and
writes the plugin author docs. In-process/trusted for MVP; sandboxing is future work.

## Tasks

### Task: Plugin manifest & lifecycle  `Wave 1`
`packages/plugin-host`: define a plugin **manifest** (id, name, version, entry points for
client and/or server halves, permissions placeholder) and a lifecycle (`activate` /
`deactivate`). A `PluginContext` exposes the registries (commands, note types, views, ribbon,
settings, editor extensions, events) — the full public surface.

### Task: Loader — discover & load local plugins  `Wave 1`
Discover plugins from a Tome-local folder (e.g., `.notes/plugins/`) and/or a config list.
Load client halves in the web app and server halves in the Fastify host **in-process**
(trusted). Handle load errors gracefully without crashing the app.

### Task: Extension-point audit & stabilization  `Wave 2`
Review every extension point used by the first-party note types and lock a stable, typed,
documented API: note-type providers, commands, ribbon/toolbar items, side-panel views,
settings tabs, editor extensions, server hooks/handlers, event bus. Version the API surface.

### Task: Settings UI & plugin management  `Wave 2`
A settings screen to view installed plugins, enable/disable them, and edit their settings
(schema-driven forms, values persisted as data). Core app settings live here too.

### Task: Sample third-party plugin  `Wave 3`
Ship a small example plugin (e.g., word-count status-bar item + a command) that lives outside
`packages/*`, proving the public API and serving as author documentation-by-example.

### Task: Plugin author docs
Write `docs/plugins.md`: manifest schema, lifecycle, each extension point with a snippet, and
how to load a local plugin. Note the trust model and that sandboxing is future work.

### Task: Tests
Vitest: manifest validation, loader error handling, registry registration/teardown on
enable/disable. Playwright: enable the sample plugin → its status-bar item and command appear;
disable → they disappear.

## Verification Checklist
- [ ] Local plugins load (client + server halves) from a Tome-local folder
- [ ] The sample third-party plugin adds a command + status-bar item via the public API only
- [ ] Enable/disable cleanly registers/unregisters contributions (no leaks)
- [ ] First-party note types still work through the now-stabilized API
- [ ] Settings UI edits and persists plugin/app settings as data
- [ ] `docs/plugins.md` documents the full extension surface
- [ ] Load errors don't crash the app; `npm run typecheck && npm test && npm run test:e2e` green

## 🛑 GATE
1. Is the plugin API surface complete for the extensibility you envision?
2. Is in-process/trusted loading acceptable for MVP (sandboxing deferred)?
3. Where should plugins live and how are they enabled (per-Tome vs global)?
4. Any blocking issues?
5. Additional feedback?

## Git Checkpoint
Stage: `packages/plugin-host/**`, settings UI, sample plugin, `docs/plugins.md`, tests.

Commit message:
`feat: plugin manifest, local loader, settings UI, and author docs`

## Feedback
_(none yet)_
