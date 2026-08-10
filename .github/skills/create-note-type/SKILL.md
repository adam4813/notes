---
name: create-note-type
description: Create a new first-party note type package using the current note registry patterns. Use when asked to add a note type (board/canvas-style), including parser/serializer, rendered/editor modes, and TanStack Query data hooks.
---

# Create Note Type (Repository Skill)

Use this skill when implementing a new first-party note type in this repository.

## Required outcome

Create a complete note-type implementation that matches the existing package patterns (`note-boards`, `note-canvas`, `note-calendar`, `note-grid`, `note-tables`) and the current note registry wiring on this branch.

## Implementation workflow

1. Confirm work is happening on a feature branch for new work.
2. Study current note-type registration and mirror it (do not invent a parallel registration path).
3. Create or update a package under `packages/note-<type>/`.
4. Wire data model + serialization + UI + registry + tests together end-to-end.

## Required file pattern

Create these files (names adjusted for `<type>`):

- `packages/note-<type>/src/<type>-note-type.ts`
- `packages/note-<type>/src/<type>-view.tsx`
- `packages/note-<type>/src/<type>-format.ts`
- `packages/note-<type>/src/<type>-format.test.ts`
- `packages/note-<type>/src/<type>-query-keys.ts`
- `packages/note-<type>/src/use-get-<entity>.ts` (query hook)
- `packages/note-<type>/src/use-create-<entity>.ts` (mutation hook as needed)
- `packages/note-<type>/src/use-update-<entity>.ts` (mutation hook as needed)
- `packages/note-<type>/src/use-delete-<entity>.ts` (mutation hook as needed)
- `packages/note-<type>/src/index.ts` (named exports only)

If the note type does not need remote data, still create `<type>-query-keys.ts` and keep future query keys centralized there.

## Note type provider contract

In `<type>-note-type.ts`, export:

- `TYPE_NOTE_TYPE_ID` constant
- `typeNoteType: NoteTypeProvider`
- `registerBuiltinNoteView(registry: NoteViewRegistry): NoteViewDisposer`

Detection rules must be explicit and deterministic (`.canvas` extension or `.md` + frontmatter `type`).

Set mode capabilities intentionally:

- `supportedModes: ["edit", "split", "rendered"]` when true source editing is supported.
- `supportedModes: ["rendered"]` for structured notes where source should be protected.
- `sourceProtected` and `supportsScrollSync` must match UX behavior.

## UI state requirements

The note UI must correctly handle:

- loading state (`Loading…` UI or equivalent)
- edit/split/render mode compatibility via `supportedModes`
- external file-change sync
- undo/redo integration where existing patterns require it

Do not use `window.prompt`; use repository prompt/modal components.

## Serialization and model rules

In `<type>-format.ts`:

- define model types and interfaces
- implement parse function with safe fallback on malformed input
- implement serialize function with stable output
- provide `empty<Type>()` or equivalent factory for new files

In `<type>-format.test.ts`:

- parse/serialize round-trip coverage
- malformed input fallback behavior
- key schema edge cases for the type

## TanStack Query requirements (mandatory for new data-fetching/mutation)

Use `@tanstack/react-query` for new fetching and mutations. Do not use ad-hoc `fetch` state wiring inside components.

### Query key factory (required)

Create `<type>-query-keys.ts` and define typed factory helpers, for example:

```ts
export const typeQueryKeys = {
  all: ["type"] as const,
  byPath: (path: string) => [...typeQueryKeys.all, path] as const,
  list: (path: string) => [...typeQueryKeys.byPath(path), "list"] as const,
  detail: (path: string, id: string) => [...typeQueryKeys.byPath(path), "detail", id] as const,
};
```

Hooks must consume these factories for `queryKey`, `invalidateQueries`, and related cache operations.

Prefer `invalidateQueries` for mutation follow-up unless the feature specifically requires eager refetch semantics.

## Registration and integration checklist

1. Export all public APIs from `packages/note-<type>/src/index.ts`.
2. Register builtin note view in the current app registry wiring (follow the active pattern on this branch).
3. Ensure provider `id` and frontmatter/file detection rules match creation templates and server behavior.
4. Keep core contracts in `@notes/core` React-free.
