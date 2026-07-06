---
name: implement-phase
description: >
  Implements the next phase of the plan. Reads plan.md to find the next
  unimplemented phase, opens its detail file, then follows a consistent workflow:
  create todos, implement code, build, verify, elicit human feedback at the GATE,
  record results, and commit. Use this skill when the user says "implement next phase",
  "start next gym", "continue implementation", "/implement-phase", or similar.
  Do NOT use for planning — only for executing an existing phase file.
---

# Implement Phase Skill

You are executing a single phase of a plan. Each phase has a detail file (in `plan/`) with tasks, verification checklist, and a GATE for human feedback. Your job is to implement the phase completely, then stop at the GATE for feedback.

---

## Step 1: Find the Next Phase

Read `plan.md` from the project root. Find the **Implementation Progress** table.

Look for the first row whose Status is:
1. `🔄 In Progress` — resume this phase (it was started in a previous session)
2. `⬜ Not Started` — start this phase

If all phases are `✅ Complete`, tell the user the prototype is done.

Open the linked phase detail file (e.g., `plan/gym-engine-core.md`). Phase files live in the `plan/`
directory and are always reached via the link in the Implementation Progress table.

---

## Step 2: Check Dependencies

Read the phase file's `Depends on` field. Verify that all listed dependency phases are `✅ Complete` in plan.md. If not, tell the user which dependency must be finished first and stop.

---

## Step 3: Mark In Progress

1. Update the phase file: change Status to `🔄 In Progress`
2. Update plan.md: change the corresponding row's Status to `🔄 In Progress`
3. Update plan.md Cross-Session Handoff with current session info

---

## Step 4: Create SQL Todos

Parse the phase file's `## Tasks` section. Create a SQL todo for each `### Task:` heading:

```sql
INSERT INTO todos (id, title, description, status) VALUES
  ('<phase>-<task-kebab>', '<Task Name>', '<brief description from task>', 'pending');
```

Use descriptive kebab-case IDs prefixed with the phase name (e.g., `engine-core-reducer`, `board-tracks-adjacency`).

If tasks have Wave annotations (e.g., "Wave 1 — parallel"), set up dependencies accordingly:
```sql
INSERT INTO todo_deps (todo_id, depends_on) VALUES ('<wave2-task>', '<wave1-task>');
```

---

## Step 5: Implement Each Task

For each todo (in dependency order):

1. **Mark in progress**: `UPDATE todos SET status = 'in_progress' WHERE id = '<id>';`
2. **Read the task details** from the phase file — it specifies files to create/modify, struct definitions, algorithms, and logic flow
3. **Implement the code**:
   - Follow the project's `.github/copilot-instructions.md` conventions (TypeScript strict, kebab-case
     files, PascalCase types, camelCase members; npm-workspaces packages `@solar-swarm/*`).
   - Respect the architecture rules: server-authoritative, **pure engine** (no I/O in `packages/engine`),
     **all content is data** (JSON/DB, never hardcoded), and the **Gang-of-Four patterns** listed in
     `copilot-instructions.md` (Factory/Strategy/Command/Chain/Composite/Observer/State Machine).
   - Keep code consistent with existing project patterns.
4. **Build & check**: `npm run typecheck && npm test` (add `-w @solar-swarm/<pkg>` to scope to one package)
   - Fix any type/test errors before moving to the next task. Run `npm run build` for a full compile when a task spans packages.
5. **Mark done**: `UPDATE todos SET status = 'done' WHERE id = '<id>';`

### Build Failure Handling

If a build fails:
- Read the error output carefully
- Fix the issue in the relevant file
- Rebuild
- If stuck after 2-3 attempts, consult the rubber-duck agent for analysis

---

## Step 6: Build & Verify

1. Do a clean build: `npm run build` (and `npm run typecheck && npm test`)
2. Start the app: `docker compose up -d postgres` (if not running), then `npm run dev`; open the
   relevant gym/route at `http://localhost:5173`
3. Walk through the `## Verification Checklist` items mentally — you can't test interactive items
   yourself, but verify the code implements each one (and that engine logic is covered by Vitest)

---

## Step 7: Hit the GATE

**This is mandatory. Never skip the GATE.**

1. Read the `## 🛑 GATE` section from the phase file
2. Use the `ask_user` tool to present structured feedback questions:
   - Include all questions from the GATE section
   - Add a boolean "Any blocking issues?" field
   - Add a free-text "Additional feedback" field
3. **Wait for the human's response before proceeding**

### Processing Feedback

After receiving feedback:

1. **Record it** in the phase file's `## Feedback` section:
   - Date, summary, issues found, deferred items, tuning changes
2. **Create TODOs** for deferred issues (items to fix later, not now):
   ```sql
   INSERT INTO todos (id, title, description, status) VALUES
     ('deferred-<description>', '<title>', '<details>', 'pending');
   ```
3. **Fix blocking concerns** — if the human reports blocking issues:
   - Implement the fix
   - Rebuild and verify
   - Ask for re-verification if needed (use ask_user again)
4. **Record tuning changes** in plan.md's Tuning History table if any constants were adjusted

---

## Step 8: Git Commit

Read the phase file's `## Git Checkpoint` section:

1. Stage only the listed files — **never `git add -A`**
   - Use `git add <specific-file>` for each file
   - For files with mixed changes: `git add -p <file>` to stage relevant hunks
2. Verify staged files: `git diff --cached --stat`
3. Commit with the specified message + Co-authored-by trailer:
   ```
   git commit -m "<message>

   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
   ```

---

## Step 9: Mark Complete

1. Update the phase file: change Status to `✅ Complete`
2. Update plan.md: change the corresponding row's Status to `✅ Complete`
3. Update plan.md Cross-Session Handoff:
   - Last session date
   - What was accomplished
   - Next action (the next phase, or "Prototype complete")

---

## Special Cases

### Core Gate (in integration-core.md)

The integration phase contains a `⚠️ CORE GATE` section after the regular GATE. This is a higher-level evaluation:

1. Complete the regular GATE first
2. Then present the Core Gate questions via `ask_user`
3. If the human says **NO** (core isn't fun):
   - Ask what needs to change
   - Create TODOs for the iteration
   - Do NOT proceed to Polish
   - The phase stays `🔄 In Progress` until the core passes
4. If **YES**: mark complete and proceed to Polish

### Resuming a Phase

If a phase is `🔄 In Progress` (started in a previous session):
1. Read the phase file's Feedback section for any prior feedback
2. Query SQL todos to see which tasks are done vs pending
3. Resume from the first pending task
4. Read plan.md Cross-Session Handoff for context on what happened last session

### Phase Has No GATE Questions Listed

This shouldn't happen — all phase files should have a GATE. If one is missing, create reasonable verification questions based on the phase's Verification Checklist and ask the human.

---

## Rules

- **One phase at a time** — complete the current phase before starting the next
- **GATE is mandatory** — never skip or auto-approve
- **Follow `.github/copilot-instructions.md`** for stack conventions, architecture rules, and patterns
- **Keep the engine pure** — no I/O in `packages/engine`; all content stays in JSON/DB, never hardcoded
- **Check after every task** — run `npm run typecheck && npm test`; catch errors early, not at the end
- **Targeted commits** — stage only specified files
- **Record everything** — feedback, tuning changes, decisions go into the phase file and plan.md
