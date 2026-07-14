---
name: ui-elements-language
description: Create or refactor UI elements using the Notes islands design language. Use when asked to add UI components, rename UI concepts, migrate UI into packages/ui, or define tab/island/panel structure.
---

# Notes UI Elements Language

Use this skill when building or refactoring UI so terminology, nesting, and behavior stay consistent for theming and future scripting APIs.

## Canonical vocabulary (use these names exactly)

- **App Shell**: root frame composed of top and bottom bars.
- **Top Bar**: title/ribbon region at the top of the shell.
- **Bottom Bar**: status bar at the bottom of the shell.
- **Island Row**: center workspace region between top and bottom bars.
- **Island**: elevated rounded container inside the island row.
- **Island Header / Body / Footer**: internal island layout primitives.
- **Tab Strip**: tabs for an island.
- **Tab Context Menu**: right-click menu for island tabs.
- **Panel Group**: stack of panels in an island body.
- **Panel Section**: one panel unit (e.g. Properties, Outline, Backlinks).

Do not introduce parallel terms for the same concept (for example "pane" vs "island" in UI-facing code and docs). Keep one public name per concept.

## Required structure

1. Keep shared primitives in `packages/ui`.
2. Keep shell-level composition in app code (`apps/web`) but built from `packages/ui` primitives.
3. Allow island-specific tab context commands, but share tab strip and menu structure components.
4. Prefer token-driven styling and avoid per-feature one-off values.

## Component targets in `packages/ui`

Create or converge toward these primitives:

- `ShellFrame`, `TopBar`, `BottomBar`
- `Island`, `IslandHeader`, `IslandBody`, `IslandFooter`
- `TabStrip`, `Tab`, `TabOverflow`
- `TabContextMenu` (shared container; per-island command data)
- `PanelGroup`, `PanelSection`, `PanelHeader`, `PanelBody`

## CSS organization rules

Use smaller CSS files grouped by concern:

- `tokens.css`
- `shell.css`
- `island.css`
- `tabs.css`
- `panel.css`
- `menu.css`

Use token names like:

- `--surface-app`, `--surface-island`, `--surface-panel`
- `--border-subtle`, `--radius-island`, `--shadow-island`

## Behavior rules

1. Tab interaction model is shared across islands (focus, activate, close, overflow, keyboard).
2. Tab context menu commands differ by island via data/config, not by forking tab UI primitives.
3. Panel behavior is compositional (panel sections inside panel groups), never ad-hoc standalone markup.

## Implementation checklist (run for each UI change)

1. Identify which canonical concept(s) the change belongs to.
2. Reuse or extend `packages/ui` primitives first.
3. Add or update tokens before hardcoding new visual values.
4. Keep context-menu structure shared; swap command lists only.
5. Update `packages/ui/README.md` when new primitives or vocabulary are introduced.
