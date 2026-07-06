# Phase 4 — Markdown Editor: Modes & Round-trip

**Status:** 🔄 In Progress
**Depends on:** 3

## Goal

The crown-jewel editor foundation: a markdown note view with **Edit / Split / Rendered**
modes, a hybrid engine (ProseMirror/TipTap for rendered editing + CodeMirror 6 for source),
and a **clean, git-safe markdown round-trip**. Rich UX (toolbar, list/checkbox behavior,
autocomplete) lands in Phase 5; this phase nails the architecture and fidelity.

## Tasks

### Task: Editor package & engine selection  `Wave 1`
`packages/editor`: set up the hybrid engine — **CodeMirror 6** for the source view and
**ProseMirror/TipTap** for the rendered/WYSIWYG view. Define the editor's document model and
a stable extension seam (so Phase 9 plugins can add editor extensions).

### Task: Markdown ⇄ document serialization  `Wave 1`
Implement lossless-as-possible markdown parsing/serialization (remark / `prosemirror-markdown`
or TipTap markdown). Preserve frontmatter, hard breaks, list markers, and spacing so diffs
stay minimal. Add round-trip **property tests** over a markdown corpus (parse → serialize →
parse is stable).

### Task: Mode switching (Edit / Split / Rendered)  `Wave 2`
A per-tab mode control. **Edit** = CM6 source. **Rendered** = ProseMirror WYSIWYG. **Split**
= both side-by-side with synchronized scroll and a shared underlying document, so edits in
either reflect in the other without data loss.

### Task: Autosave & persistence  `Wave 2`
Debounced autosave dispatching `file.write` through the command bus, dirty-state indicator,
conflict handling if the file changed on disk (watcher) while editing (prompt/merge choice).
Cursor/selection preserved across mode switches.

### Task: Frontmatter/properties handling  `Wave 2`
Parse and edit YAML frontmatter (properties) as a structured region above the body; keep it
intact through round-trips and expose it to the index (Phase 2).

### Task: Tests
Vitest: round-trip stability on a corpus, frontmatter preservation, mode-switch document
integrity, autosave/dirty logic, on-disk-change conflict path. Playwright: type in rendered
mode, switch to source, confirm markdown is correct.

## Verification Checklist
- [ ] Edit / Split / Rendered modes all operate on one consistent document
- [ ] Editing in **rendered** mode produces correct, minimal-diff markdown
- [ ] Round-trip (parse→serialize→parse) is stable across the test corpus
- [ ] Frontmatter survives edits and round-trips intact
- [ ] Autosave persists via the command bus; dirty state is accurate
- [ ] External on-disk changes during editing are detected and handled
- [ ] `npm run typecheck && npm test && npm run test:e2e` green

## 🛑 GATE
1. Does the rendered-mode editing feel right, and is the markdown output clean enough for git?
2. Is the split-view sync behavior what you expect (scroll + live document)?
3. How should on-disk-vs-editor conflicts resolve (keep mine / reload / merge)?
4. Any blocking issues?
5. Additional feedback?

## Git Checkpoint
Stage: `packages/editor/**`, `apps/web/**` (editor view integration), tests/corpus.

Commit message:
`feat: markdown editor with edit/split/rendered modes and clean round-trip`

## Feedback

**2026-07-06 — Implementation complete; awaiting user GATE (critical decision).**

Built the hybrid editor in `@notes/editor`:
- **CodeMirror 6** source view + **TipTap/ProseMirror** rendered (WYSIWYG) view, driven by a
  single markdown `value`. `tiptap-markdown` handles serialization; StarterKit v3 bundles
  `list-keymap` (Tab/Shift-Tab list indent) and TaskList/TaskItem give checkboxes.
- **Modes:** Edit / Split / Rendered via a segmented switch; **Split** shows both editors kept
  in sync through the shared value (echo-guarded so there are no update loops).
- **Autosave:** debounced (600ms) write through the command bus; Saved/Saving/Error status.
- **External change:** reloads from disk when there are **no unsaved edits**; otherwise shows
  "Changed on disk" (non-destructive).

Verified: `typecheck`, `lint`, `test` (41), `build`, and **Playwright** — typing in rendered
mode round-trips into the CodeMirror source; split shows both editors.

**Deferred to Phase 5 (per plan):** formatting toolbar, wikilink/tag autocomplete + rendering
inside the editor (currently `[[links]]` show as literal text in the editor), and refined
list/checkbox affordances.

### 🛑 GATE — awaiting your input
1. Does **rendered-mode editing feel right**, and is the markdown output clean enough for git?
2. Is the **Split** view sync behavior what you expect?
3. How should **on-disk vs editor conflicts** resolve (keep mine / reload / merge)? (Current:
   reload when clean, warn when dirty.)
