# Writing Plugins for Notes

Notes is extensible through the same API its first-party note types use. Plugins are
**local and trusted** in the MVP (loaded in-process); a sandboxed, third-party marketplace is
future work. This guide documents the public `@notes/plugin-host` surface.

## Trust model & loading (MVP)

- Plugins are **trusted** and run **in-process** (no sandbox yet).
- The web app bundles a list of local plugins (see `apps/web/src/plugins/`). Each is a module
  exporting a `NotesPlugin`.
- Enable/disable plugins from **Settings** (⚙ in the ribbon). **The enabled set is scoped per
  Tome** (persisted under `notes.plugins.enabled:<tome>` in `localStorage`), so each Tome
  remembers its own plugins; enabled plugins re-activate on load.
- **Future:** discover and load plugin folders from a Tome-local `.notes/plugins/` directory,
  plus a server half loaded by the Fastify host. The manifest already declares `entry.server`
  for this.

## Manifest

```ts
import type { NotesPlugin } from "@notes/plugin-host";

export const myPlugin: NotesPlugin = {
  manifest: {
    id: "my-plugin",          // kebab-case, unique
    name: "My Plugin",
    version: "1.0.0",
    description: "What it does.",
    author: "You",
    entry: { client: true },  // server: true reserved for the future server half
    permissions: [],          // reserved capability model
  },
  activate(ctx) {
    /* register contributions here */
  },
  deactivate() {
    /* optional: extra cleanup; contributions are auto-disposed */
  },
};
```

The manifest is validated with zod (`validateManifest`). Invalid manifests are rejected and
surfaced in Settings with the error.

## Lifecycle

- `activate(ctx)` runs when the plugin is enabled. Register all contributions through `ctx`.
- `deactivate()` runs when disabled. You rarely need it: **every contribution registered via
  `ctx` returns a disposer and is automatically removed on disable**, so there are no leaks.
- Activation errors are captured per-plugin (shown in Settings) and never crash the app.

## The `PluginContext` API

| Member | Purpose |
|--------|---------|
| `ctx.manifest` | The validated manifest. |
| `ctx.registerCommand({ id, label, run, defaultHotkey? })` | Adds a command to the command palette, optionally with a default hotkey (e.g. `"Mod+Shift+W"`). Returns a disposer. |
| `ctx.addStatusBarItem({ id, mount })` | Adds a status-bar item. `mount(el)` receives a host element and may return a disposer. |
| `ctx.setThemeToken(name, value)` | Overrides a CSS design token (e.g. `ctx.setThemeToken("--accent", "#f00")`). Returns a disposer that restores the token. |
| `ctx.document.get()` | The active document `{ path, content, type }` or `null`. |
| `ctx.document.subscribe(cb)` | Reacts to active-document changes. Returns a disposer. |
| `ctx.settings.get(key, fallback)` / `set(key, value)` | Per-plugin persisted settings (data). |

### Example: the Word Count sample

See `apps/web/src/plugins/word-count.ts`. It adds a status-bar item that shows the active
note's word count and a command — using only the public API:

```ts
ctx.addStatusBarItem({
  id: "word-count.status",
  mount(el) {
    const render = () => {
      const doc = ctx.document.get();
      el.textContent = doc ? `${countWords(doc.content)} words` : "";
    };
    render();
    return ctx.document.subscribe(render); // auto-disposed on disable
  },
});

ctx.registerCommand({
  id: "word-count.show",
  label: "Word Count: show for active note",
  run: () => { /* … */ },
});
```

## Note types are plugins too

The first-party **table**, **canvas**, and **board** note types register through the same
`NoteTypeProvider` extension point (`@notes/core`'s `NoteTypeRegistry`) that a plugin would
use — there is no special-casing in core. Post-MVP note types (calendar, grid) and embeddable
widgets will build on this same seam.
