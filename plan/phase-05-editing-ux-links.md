# Phase 5 — Rich Editing UX, Links & Backlinks

**Status:** ⬜ Not Started
**Depends on:** 4, 2

## Goal

Make editing genuinely delightful: a toggleable **rich toolbar**, natural **lists &
checkboxes** (Tab / Shift+Tab indent anywhere on the line), inline **wikilink** and **tag**
autocomplete wired to the index, click-to-navigate links, and a live **backlinks** panel.

## Tasks

### Task: Formatting toolbar  `Wave 1`
A toggleable toolbar operating in rendered (and source) mode: bold, italic, strikethrough,
headings, quote, code/code-block, bulleted/numbered/task lists, link, table insert, and
horizontal rule. Reflects the current selection's active formats. Keyboard shortcuts for each.

### Task: Natural lists & checkboxes  `Wave 1`
Enter continues a list item; empty item exits the list. **Tab / Shift+Tab** indent/outdent
the current item from **anywhere in the line** (not just at the start). Checkbox items toggle
on click and via shortcut; `[ ]`/`[x]` render as interactive checkboxes and serialize back to
markdown correctly. Smart paste of lists.

### Task: Wikilink autocomplete & navigation  `Wave 2`
Typing `[[` opens an autocomplete popup fed by the index (`resolveWikilink`, note titles,
headings, aliases). Selecting inserts a proper `[[link]]`. Clicking/⌘-clicking a link opens
the target (creating it if missing, per setting). Handle aliases `[[target|shown]]` and
heading/block refs.

### Task: Tag autocomplete  `Wave 2`
Typing `#` opens tag autocomplete from `allTags()`; inserting maintains valid tag syntax and
updates the index on save.

### Task: Backlinks & outline panels  `Wave 2`
Right-sidebar **Backlinks** panel showing notes linking to the current note (with context
snippets from the index) and an **Outline** panel (heading tree) with click-to-scroll. Both
update live on edits/index changes.

### Task: Tests
Vitest: list/checkbox indent logic, wikilink/tag insertion + serialization, backlink query
integration. Playwright: `[[` autocomplete inserts a link and navigates; Tab indents a list
item mid-line; backlinks panel reflects a new link.

## Verification Checklist
- [ ] Toolbar actions apply correctly in rendered mode and emit clean markdown
- [ ] Tab / Shift+Tab indent/outdent list items from anywhere in the line
- [ ] Checkboxes toggle interactively and round-trip to `[ ]`/`[x]`
- [ ] `[[` and `#` autocomplete pull from the live index; links navigate/create
- [ ] Backlinks and outline panels are accurate and update live
- [ ] `npm run typecheck && npm test && npm run test:e2e` green

## 🛑 GATE
1. Does list/checkbox/indent behavior feel natural (the key UX promise)?
2. Is the toolbar's scope right (anything to add/remove for MVP)?
3. Should clicking a missing wikilink create the note silently, prompt, or be configurable?
4. Any blocking issues?
5. Additional feedback?

## Git Checkpoint
Stage: `packages/editor/**` (toolbar, lists, autocomplete), `apps/web/**` (backlinks/outline
panels), tests.

Commit message:
`feat: rich editing toolbar, natural lists/checkboxes, wikilink/tag autocomplete, backlinks`

## Feedback
_(none yet)_
