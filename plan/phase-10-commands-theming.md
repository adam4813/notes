# Phase 10 — Command Palette, Hotkeys & Theming

**Status:** ⬜ Not Started
**Depends on:** 3, 5

## Goal

Finish the keyboard-first layer and visual system: a fully populated **command palette**,
**quick switcher**, a customizable **hotkey** system, and a polished **theming** system
(light/dark tokens, accent, system preference) that plugins can extend.

## Tasks

### Task: Command registry surfacing  `Wave 1`
Populate the command palette (`Ctrl/Cmd+P`) from the full command registry — core + note-type
+ plugin commands — with fuzzy search, recent commands, and contextual availability. Each
command exposes id, title, optional icon, and default hotkey.

### Task: Quick switcher & navigation  `Wave 1`
`Ctrl/Cmd+O` quick switcher over the index (notes by title/path/alias, fuzzy), with recent
files and "create new note" fallback. Optional heading/symbol jump within the current note.

### Task: Hotkey system  `Wave 2`
A hotkey manager mapping key combos → commands, with a **settings UI** to view/rebind/reset,
conflict detection, and per-platform defaults (⌘ vs Ctrl). Persist as data.

### Task: Theming system  `Wave 2`
Finalize CSS-variable design tokens (color, spacing, typography, radius, shadows), light/dark
themes honoring system preference, an accent color, and an API for plugins/themes to add or
override tokens. Ensure no flash-of-wrong-theme on load.

### Task: Tests
Vitest: hotkey resolution/conflicts, command filtering. Playwright: open palette and run a
command; rebind a hotkey and use it; toggle theme and confirm tokens apply.

## Verification Checklist
- [ ] Palette lists all core/note-type/plugin commands with fuzzy search + recents
- [ ] Quick switcher opens notes fast and supports create-on-miss
- [ ] Hotkeys are rebindable, conflict-checked, and persisted; platform defaults correct
- [ ] Theming tokens drive the whole UI; light/dark + accent work with no flash
- [ ] Plugins can contribute commands, hotkeys, and theme tokens
- [ ] `npm run typecheck && npm test && npm run test:e2e` green

## 🛑 GATE
1. Are the default hotkeys and palette behavior comfortable?
2. How customizable should theming be for MVP (accent only vs full token editing / custom CSS)?
3. Should there be a few built-in themes beyond light/dark?
4. Any blocking issues?
5. Additional feedback?

## Git Checkpoint
Stage: `apps/web/**` (palette, switcher, hotkeys, theming), `packages/ui/**` tokens, settings,
tests.

Commit message:
`feat: command palette, quick switcher, rebindable hotkeys, and theming system`

## Feedback
_(none yet)_
