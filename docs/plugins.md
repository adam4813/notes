# Writing Plugins for Notes

Notes is extensible through the same API its first-party note types use. Plugins are
**local and trusted** in the MVP (loaded in-process); a sandboxed, third-party marketplace is
future work. This guide documents the complete public `@notes/plugin-host` surface.

## Trust model & loading

- Plugins are **trusted** and run **in-process** (no sandbox yet).
- **Bundled plugins** ship with the app (`apps/web/src/plugins/`). Each exports a `NotesPlugin`.
- **Tome plugins** are loaded from `.notes/plugins/` inside your Tome at startup. Install them
  via **Settings → Plugins** (drag-drop or browse a `.zip`) or by dropping a plugin folder
  directly into `.notes/plugins/` via the OS file explorer. Both methods require a **restart**
  to take effect. Then enable the plugin from **Settings → Plugins**.
- Enable/disable plugins from **Settings** (⚙ in the ribbon). The enabled set is **scoped per
  Tome** (`notes.plugins.enabled:<tome>` in `localStorage`), so each Tome remembers its own.

## Installing a Tome plugin

### Via the Settings UI (recommended)

1. Open **Settings → Plugins**.
2. Drag a plugin `.zip` onto the install zone, or click to open a file picker.
3. The app extracts and validates the ZIP, then notifies you to restart.
4. After restart, toggle the plugin on from the plugin list.

The ZIP file must contain `manifest.json` and `client.js` either at the root or inside a
single top-level folder:

```
json-viewer.zip
└── manifest.json
└── client.js
```

### Via the OS file explorer

Drop a plugin folder directly into `.notes/plugins/` inside your Tome:

```
<your-tome>/
  .notes/
    plugins/
      json-viewer/
        manifest.json
        client.js
```

Restart the app, then enable the plugin from Settings.


## Manifest

```ts
import type { NotesPlugin } from "@notes/plugin-host";

export const myPlugin: NotesPlugin = {
  manifest: {
    id: "my-plugin",          // kebab-case, unique — [a-z0-9][a-z0-9-]*
    name: "My Plugin",
    version: "1.0.0",
    description: "What it does.",
    author: "You",
    entry: { client: true },  // server: true reserved for future server half
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

### `manifest.json` for a Tome plugin

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "What it does.",
  "author": "You",
  "entry": { "client": true },
  "permissions": []
}
```

### `client.js` format

The `client.js` must be vanilla JS (no bundler step required) and export the plugin as the
`default` export or as a named export with the same value as the plugin id:

```js
const myPlugin = {
  manifest: { /* same as manifest.json */ },
  activate(ctx) { /* ... */ },
};
export default myPlugin;
```

Because `client.js` is loaded via a blob URL dynamic import, it **cannot use bare `import`
specifiers** (e.g. `import { foo } from "@notes/plugin-host"` will fail). All logic must be
self-contained or use DOM APIs. The `PluginContext` passed to `activate` is the only bridge
to the host application.

## Lifecycle

- `activate(ctx)` runs when the plugin is enabled. Register all contributions through `ctx`.
- `deactivate()` runs when disabled. You rarely need it: **every contribution registered via
  `ctx` returns a disposer and is automatically removed on disable**, so there are no leaks.
- Activation errors are captured per-plugin (shown in Settings) and never crash the app.

---

## The `PluginContext` API (`ctx`)

All contributions return a **disposer** `() => void`. The plugin manager calls these
automatically when a plugin is disabled, so cleanup is handled for you unless you need
extra teardown logic.

### `ctx.manifest`

The validated `PluginManifest` for this plugin (read-only).

---

### `ctx.registerCommand(command)` → `Disposer`

Adds a command to the command palette.

```ts
interface PluginCommand {
  id: string;           // unique command id, e.g. "my-plugin.do-thing"
  label: string;        // shown in palette, e.g. "My Plugin: Do Thing"
  run: () => void;      // called when the user selects the command
  defaultHotkey?: string; // optional default shortcut, e.g. "Mod+Shift+W"
}
```

```ts
ctx.registerCommand({
  id: "my-plugin.greet",
  label: "My Plugin: Say hello",
  defaultHotkey: "Mod+Shift+H",
  run: () => console.log("Hello from my plugin!"),
});
```

Users can rebind hotkeys in **Settings → Hotkeys**.

---

### `ctx.addStatusBarItem(item)` → `Disposer`

Adds a custom item to the status bar at the bottom of the screen. The `mount` function
receives a host `HTMLElement` and may return a disposer for its own subscriptions/timers.

```ts
interface StatusBarItem {
  id: string;
  mount: (element: HTMLElement) => Disposer | void;
}
```

```ts
ctx.addStatusBarItem({
  id: "my-plugin.status",
  mount(el) {
    el.textContent = "Hello!";
    const unsub = ctx.document.subscribe((doc) => {
      el.textContent = doc ? `📄 ${doc.path}` : "";
    });
    return unsub; // auto-called on disable
  },
});
```

---

### `ctx.setThemeToken(name, value)` → `Disposer`

Overrides a CSS design token on `:root` for the duration the plugin is enabled. Useful
for theme-altering plugins.

```ts
ctx.setThemeToken("--accent", "#e11d48");
ctx.setThemeToken("--font-mono", "'JetBrains Mono', monospace");
```

---

### `ctx.registerFileHandler(handler)` → `Disposer`

Registers a **file-type renderer** for one or more file extensions. The handler takes over
rendering both in the full editor pane and in inline embeds (`![[file.ext]]`).

```ts
interface FileTypeHandler {
  extensions: string[];       // lowercase with dot, e.g. [".json", ".jsonc"]
  label: string;              // short display label, e.g. "JSON"
  supportsFrontmatter: boolean; // false → Properties panel hides frontmatter editing
  mountEditor: (element: HTMLElement, props: FileViewProps) => Disposer | void;
  mountEmbed?: (element: HTMLElement, props: FileViewProps) => Disposer | void;
}

interface FileViewProps {
  path: string;               // path of the file being rendered
  content: string;            // current raw text content
  onChange?: (content: string) => void; // call to save updated content
}
```

- `mountEditor` is called (with the element pre-cleared) whenever the file is opened or
  its content changes. Return a disposer for cleanup.
- `mountEmbed` is the compact inline embed renderer. Falls back to `mountEditor` when omitted.
- `supportsFrontmatter: false` tells the right-panel **Properties** section that this file
  type does not use YAML frontmatter — the panel shows a hint instead of the property editor.

```ts
ctx.registerFileHandler({
  extensions: [".csv"],
  label: "CSV",
  supportsFrontmatter: false,
  mountEditor(element, { content }) {
    const pre = document.createElement("pre");
    pre.textContent = content;
    element.appendChild(pre);
  },
});
```

---

### `ctx.document`

A reactive signal for the **active document** (the note currently open in the focused
editor pane).

```ts
interface DocumentSignal {
  get: () => ActiveDocument | null;
  subscribe: (listener: (doc: ActiveDocument | null) => void) => Disposer;
}

interface ActiveDocument {
  path: string;    // e.g. "notes/my-note.md"
  content: string; // raw text content
  type: string;    // "markdown" | "table" | "canvas" | "board" | "json" | …
}
```

```ts
// Reactive — subscribe to changes:
const unsub = ctx.document.subscribe((doc) => {
  console.log("Active doc:", doc?.path);
});

// Imperative — read the current value:
const doc = ctx.document.get();
```

---

### `ctx.settings`

Per-plugin key/value storage backed by `localStorage`. Values are JSON-serialised.

```ts
interface PluginSettings {
  get: <T>(key: string, fallback: T) => T;
  set: (key: string, value: unknown) => void;
}
```

```ts
// Read a setting (with fallback):
const enabled = ctx.settings.get("showBadge", true);

// Persist a setting:
ctx.settings.set("showBadge", false);
```

Keys are namespaced automatically as `notes.plugin.<id>.<key>`, so there is no collision
between plugins.

---

## Full example — Tome plugin (`client.js`)

The file must export a `NotesPlugin` as `default` (or as a named export matching the plugin id).

```js
// .notes/plugins/my-plugin/client.js
const myPlugin = {
  manifest: {
    id: "my-plugin",
    name: "My Plugin",
    version: "1.0.0",
    description: "Counts words in the status bar.",
    author: "You",
    entry: { client: true },
    permissions: [],
  },

  activate(ctx) {
    ctx.addStatusBarItem({
      id: "my-plugin.word-count",
      mount(el) {
        const render = () => {
          const doc = ctx.document.get();
          el.textContent = doc ? `${doc.content.split(/\S+/g).length - 1} words` : "";
        };
        render();
        return ctx.document.subscribe(render);
      },
    });
  },
};

export default myPlugin;
```

---

## Note types are plugins too

The first-party **table**, **canvas**, and **board** note types register through the same
`NoteTypeProvider` extension point (`@notes/core`'s `NoteTypeRegistry`) that a plugin would
use — there is no special-casing in core.

For file-type renderers (non-markdown files like JSON, CSV, TOML, etc.), use
`ctx.registerFileHandler` as documented above.

---

## Shipped example plugin: JSON Viewer

The Tome ships a ready-to-install JSON viewer at `.notes/plugins/json-viewer/` in the
`dev-tome` development fixture. Copy that folder into the `.notes/plugins/` directory of
your own Tome, restart, and enable **JSON Viewer** in Settings.

What it does:

- Opens `.json` files with syntax-highlighted pretty-printing in the full editor pane.
- Renders compact `![[file.json]]` embeds inline.
- Declares `supportsFrontmatter: false` so the Properties panel shows a hint rather than
  trying to read/write YAML frontmatter on a JSON file.

