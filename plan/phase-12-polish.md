# Phase 12 — MVP Polish, Performance & Hardening

**Status:** 🔄 In Progress
**Depends on:** 4, 5, 6, 7, 8, 9, 10, 11

## Goal

The "extremely high polish" pass that turns a feature-complete build into a product:
micro-interactions, consistent design, robustness, performance on large Tomes, accessibility,
onboarding, and end-to-end coverage of core flows. This is the final integration GATE.

## Tasks

### Task: Visual & interaction polish  `Wave 1`
Consistent spacing/typography/iconography via `@notes/ui` tokens; tasteful transitions and
micro-interactions; empty states, loading skeletons, and clear error/undo **toasts**; refined
drag-and-drop affordances across explorer, tabs, boards, and canvas.

### Task: Robustness & error handling  `Wave 1`
Graceful handling of file conflicts, missing files, malformed notes (bad frontmatter/CSV/
JSONCanvas), plugin failures, and offline/disconnected server. Global error boundary,
recoverable states, and an autosave/crash-safety review. Never lose user edits.

### Task: Performance on large Tomes  `Wave 2`
Virtualize the explorer, search results, and large grids; lazy-load note content and index
queries; debounce/batch reindex; measure cold start, open-note latency, search latency, and
big-table scroll against a **large fixture Tome**. Set and check budgets.

### Task: Accessibility & keyboard completeness  `Wave 2`
Focus management, ARIA roles, visible focus rings, full keyboard operability of core flows
(explorer, tabs, editor, palette, boards), reduced-motion support, and adequate color
contrast in both themes.

### Task: Onboarding & first-run  `Wave 2`
Polished first-run: create/open a Tome, seed an optional sample Tome (welcome note, a table,
a board, a canvas) to showcase features, and a lightweight help/shortcuts overlay.

### Task: End-to-end core-flow coverage  `Wave 3`
Playwright journeys: create Tome → write a linked note → see backlink → make a table → make a
board → make a canvas → search → command palette → theme toggle → reload persists everything.
Wire into `test:e2e`.

### Task: Docs & release readiness
Update `README.md` (run/build, features), ensure `docs/plugins.md` current, and produce a
short "known limitations / deferred (graph, collab, desktop wrapper)" note.

## Verification Checklist
- [ ] UI is visually consistent; interactions feel smooth and intentional
- [ ] Malformed files and plugin/server failures degrade gracefully; no data loss
- [ ] Large-Tome performance meets budgets (cold start, open, search, scroll)
- [ ] Core flows are fully keyboard-operable and reasonably accessible in both themes
- [ ] First-run/onboarding (optional sample Tome) works end to end
- [ ] Playwright covers the full core journey and passes
- [ ] `npm run typecheck && npm run lint && npm test && npm run test:e2e` all green

## 🛑 GATE
1. Does the app feel "extremely polished" and ready as an MVP, or what still feels rough?
2. Are the performance budgets acceptable for your expected Tome sizes?
3. Should the sample/onboarding Tome ship by default or be opt-in?
4. Any blocking issues?
5. Additional feedback?

### ⚠️ MVP GATE
After the regular GATE, confirm the MVP as a whole: is the core experience cohesive,
delightful, and extensible enough to build on? If **NO**, capture what must change as TODOs
and iterate before declaring the MVP complete. If **YES**, the MVP is done.

## Git Checkpoint
Stage: polish changes across `apps/web/**`, `packages/**`, e2e tests, `README.md`, docs.

Commit message:
`feat: MVP polish, performance, accessibility, onboarding, and e2e coverage`

## Feedback
**2025 session (final GATE + MVP GATE — user reviewed):**
- **MVP accepted as complete**: cohesive, polished, extensible; no blocking issues. 🎉
- Performance choices accepted (results capped/memoized; heavy virtualization deferred).
- **Sample Tome → seed automatically on first run** (was opt-in).
- Follow-up polish requested (implemented this session):
  1. Auto-seed sample notes on first run (tracked by a one-time flag).
  2. **Properties panel** always visible and **editable** for note types that support frontmatter
     (markdown/table/board).
  3. **Explorer** shows a subdued `[Table]/[Board]/[Canvas]` type tag after the filename
     (extension ≠ type).
  4. **Tabs** show the filename subdued after the title.
  5. **Settings**: adjustable **app font size** and **editor font size**.
  6. Editor toolbar **find** expands inline (find input in the toolbar); only replace adds a row.
  7. **Tab context menu**: added Close others / Close to the right / Close to the left / Close all.
- No blocking issues; full green (86 unit, 19 e2e, build).

