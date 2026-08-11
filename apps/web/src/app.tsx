import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NoteTypeRegistry, formatCombo } from "@notes/core";
import { registerMarkdownNoteType } from "@notes/editor";
import { emptyCanvas, registerBuiltinNoteType as registerCanvasNoteType } from "@notes/note-canvas";
import { emptyBoard, registerBuiltinNoteType as registerBoardNoteType } from "@notes/note-boards";
import {
  emptyCalendar,
  registerBuiltinNoteType as registerCalendarNoteType,
} from "@notes/note-calendar";
import { emptyGrid, registerBuiltinNoteType as registerGridNoteType } from "@notes/note-grid";
import {
  emptyMermaid,
  registerBuiltinNoteType as registerMermaidNoteType,
} from "@notes/note-mermaid";
import {
  emptyTableMarkdown,
  registerBuiltinNoteType as registerTableNoteType,
} from "@notes/note-tables";
import type { PluginManifest } from "@notes/plugin-host";
import type { ThemeMeta } from "@notes/shared";
import { api, type FileEntry } from "./api/client";
import { flushQueue, pendingCount } from "./api/offline-queue";
import { connectTomeChanges } from "./api/ws";
import { Palette } from "./components/palette";
import { RightPanel } from "./components/right-panel";
import { Ribbon } from "./components/ribbon";
import { SettingsModal } from "./components/settings-modal";
import { SETTINGS_TAB_PATH } from "./components/settings-view";
import { HelpOverlay } from "./components/help-overlay";
import { TomeReplace } from "./components/tome-replace";
import { Sidebar, type SidebarView } from "./components/sidebar";
import { StatusBar } from "./components/status-bar";
import { Toaster } from "./components/toaster";
import { UpdateBanner } from "./components/update-banner";
import { Workspace } from "./components/workspace";
import { AppServicesProvider } from "./state/app-services";
import { useWorkspace } from "./state/app-context";
import { useToasts } from "./state/toast";
import { usePlugins } from "./state/use-plugins";
import { useHotkeys } from "./state/use-hotkeys";
import { useUndoStack } from "./state/undo-context";
import { makeUndoableFileOps } from "./api/undoable-file-ops";
import { loadRecentCommands, pushRecentCommand, type AppCommand } from "./state/commands";
import { flattenFiles } from "./state/selectors";
import {
  applyAccent,
  applyTheme,
  loadAccent,
  ACCENT_PRESETS,
  applyFontSizes,
  loadFontSizes,
  applyFontFamilies,
  loadFontFamilies,
  FONT_FAMILY_PRESETS,
  querySystemFonts,
  buildFontFamilyOptions,
} from "./theme/theme";
import type { FontFamilyOption } from "./theme/theme";
import { loadExternalThemes } from "./theme/theme-loader";
import type { SettingsBodyProps } from "./components/settings-view";
import { normalizeMediaDirectory } from "./lib/images";
import {
  makeStandalonePath,
  registerStandaloneHandle,
  makeFsaHandle,
  makeElectronHandle,
  isStandalonePath,
} from "./lib/standalone-handles";

type PaletteMode = "files" | "commands" | null;
type RenderedWidthSetting = "normal" | "wide";
const RENDERED_WIDTH_SETTING_KEY = "notes.settings.renderedWidthDefault";

function normalizeRenderedWidthSetting(value: string | null | undefined): RenderedWidthSetting {
  return value === "wide" ? "wide" : "normal";
}

function baseNoExt(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
}

/** Picks the first free "Base", "Base 1", … name in `dir`. */
function nextName(dir: string, base: string, ext: string, tree: FileEntry[]): string {
  const existing = new Set(flattenFiles(tree).map((file) => file.path.toLowerCase()));
  const make = (n: number) => {
    const name = n === 0 ? `${base}${ext}` : `${base} ${n}${ext}`;
    return dir ? `${dir}/${name}` : name;
  };
  let n = 0;
  while (existing.has(make(n).toLowerCase())) {
    n += 1;
  }
  return make(n);
}

export function App() {
  const { state, dispatch } = useWorkspace();
  const { notify } = useToasts();
  const [paletteMode, setPaletteMode] = useState<PaletteMode>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");
  const [renameRequestPath, setRenameRequestPath] = useState<string | null>(null);
  // tomeActive controls whether the Tome is loaded and shown. Starts as false
  // when the app is opened via OS file association (?standalone=1 URL param).
  const [tomeActive, setTomeActive] = useState(
    () => new URLSearchParams(window.location.search).get("standalone") !== "1",
  );
  const [openSettingsInTab, setOpenSettingsInTabState] = useState(
    () => globalThis.localStorage?.getItem("notes.settings.openInTab") === "true",
  );
  const [mediaDirectory, setMediaDirectoryState] = useState(() =>
    normalizeMediaDirectory(
      globalThis.localStorage?.getItem("notes.settings.mediaDirectory") ?? "media",
    ),
  );
  const [renderedWidthDefault, setRenderedWidthDefaultState] = useState<RenderedWidthSetting>(() =>
    normalizeRenderedWidthSetting(globalThis.localStorage?.getItem(RENDERED_WIDTH_SETTING_KEY)),
  );
  const [accent, setAccentState] = useState(() => loadAccent());
  const [fontSizes, setFontSizes] = useState(() => loadFontSizes());
  const [fontFamilies, setFontFamilies] = useState(() => loadFontFamilies());
  const [fontFamilyOptions, setFontFamilyOptions] =
    useState<FontFamilyOption[]>(FONT_FAMILY_PRESETS);
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>(() => loadRecentCommands());
  const [noteTypes, setNoteTypes] = useState<Record<string, string>>({});
  const [externalThemes, setExternalThemes] = useState<ThemeMeta[]>([]);
  const [pendingRestartPlugins, setPendingRestartPlugins] = useState<PluginManifest[]>([]);

  // Create the NoteTypeRegistry once and register all built-in note types.
  // Kept here (not in usePlugins) so the registry is an explicit app-level
  // concern; plugins extend it via PluginContext.registerNoteType.
  const noteTypeRegistry = useMemo(() => {
    const registry = new NoteTypeRegistry();
    registerMarkdownNoteType(registry);
    registerCanvasNoteType(registry);
    registerBoardNoteType(registry);
    registerTableNoteType(registry);
    registerMermaidNoteType(registry);
    registerCalendarNoteType(registry);
    registerGridNoteType(registry);
    return registry;
  }, []);

  const plugins = usePlugins(noteTypeRegistry);
  // Paths of freshly-created notes not yet modified/named (discarded on close).
  const [provisional, setProvisional] = useState<Set<string>>(new Set());

  const undoStack = useUndoStack();
  const undoableFileOps = useMemo(() => makeUndoableFileOps(undoStack), [undoStack]);

  // Global undo/redo hotkeys. We deliberately skip contentEditable targets so
  // TipTap can handle Ctrl+Z within editor windows themselves.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const target = e.target as HTMLElement | null;
      const inEditable = Boolean(
        target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName)),
      );
      if (inEditable) return;
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        void undoStack.undo().then((label) => {
          if (label) notify(`Undone: ${label}`, { kind: "info" });
        });
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        void undoStack.redo().then((label) => {
          if (label) notify(`Redone: ${label}`, { kind: "info" });
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undoStack, notify]);

  const refreshTree = useCallback(async () => {
    const [{ entries }, { notes }] = await Promise.all([api.files(), api.notes()]);
    dispatch({ type: "setTree", tree: entries });
    setNoteTypes(Object.fromEntries(notes.map((note) => [note.path, note.type])));
  }, [dispatch]);

  const createOfType = useCallback(
    (base: string, ext: string, contentFor: (name: string) => string, dir?: string) => {
      void (async () => {
        const path = nextName(dir ?? "", base, ext, state.tree);
        const content = contentFor(baseNoExt(path));
        await undoableFileOps.createFile(path, content);
        await refreshTree();
        dispatch({ type: "openFile", path, title: baseNoExt(path) });
        setProvisional((prev) => new Set(prev).add(path));
      })();
    },
    [dispatch, refreshTree, state.tree, undoableFileOps],
  );

  const createNote = useCallback(
    (dir?: string) => createOfType("New Note", ".md", (name) => `# ${name}\n\n`, dir),
    [createOfType],
  );
  const createTable = useCallback(
    (dir?: string) => createOfType("New Table", ".md", () => emptyTableMarkdown(), dir),
    [createOfType],
  );
  const createCanvas = useCallback(
    (dir?: string) => createOfType("New Canvas", ".canvas", () => emptyCanvas(), dir),
    [createOfType],
  );
  const createBoard = useCallback(
    (dir?: string) => createOfType("New Board", ".md", () => emptyBoard(), dir),
    [createOfType],
  );
  const createMermaid = useCallback(
    (dir?: string) => createOfType("New Diagram", ".md", () => emptyMermaid(), dir),
    [createOfType],
  );
  const createCalendar = useCallback(
    (dir?: string) => createOfType("New Calendar", ".md", () => emptyCalendar(), dir),
    [createOfType],
  );
  const createGrid = useCallback(
    (dir?: string) => createOfType("New Grid", ".md", () => emptyGrid(), dir),
    [createOfType],
  );

  const createNamedNote = useCallback(
    (name: string) => {
      const safe = name.replace(/[\\/:]+/g, "-").trim();
      if (!safe) {
        return;
      }
      const path = safe.toLowerCase().endsWith(".md") ? safe : `${safe}.md`;
      void (async () => {
        await api.create(path, `# ${baseNoExt(path)}\n\n`);
        await refreshTree();
        dispatch({ type: "openFile", path, title: baseNoExt(path) });
      })();
    },
    [dispatch, refreshTree],
  );

  const markModified = useCallback((path: string) => {
    setProvisional((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  // First-run onboarding: seed a small showcase Tome.
  const seedSampleNotes = useCallback(() => {
    void (async () => {
      const welcome =
        "# Welcome to Notes\n\n" +
        "This is a plain Markdown file on disk — commit it, sync it, edit it anywhere.\n\n" +
        "Try these:\n\n" +
        "- Open the command palette with **Ctrl/Cmd+P**\n" +
        "- Link to another note: [[Sample Table]]\n" +
        "- Tag a note with #welcome\n" +
        "- Search and tags live in the left sidebar\n";
      try {
        await api.create("Welcome.md", welcome);
        await api.create("Sample Table.md", emptyTableMarkdown());
        await api.create("Sample Board.md", emptyBoard());
        await api.create("Sample Canvas.canvas", emptyCanvas());
        await api.create("Sample Diagram.md", emptyMermaid());
        await refreshTree();
        dispatch({ type: "openFile", path: "Welcome.md", title: "Welcome" });
        notify("Added sample notes", { kind: "success" });
      } catch {
        notify("Couldn't add sample notes", { kind: "error" });
      }
    })();
  }, [refreshTree, dispatch, notify]);

  const renamePath = useCallback(async (path: string) => {
    setSidebarView("explorer");
    setRenameRequestPath(path);
  }, []);

  const openStandaloneFile = useCallback(async () => {
    const electronApi = window.electronAPI;
    if (electronApi?.openFileDialog) {
      const result = await electronApi.openFileDialog();
      if (!result) return; // user canceled
      const standalonePath = makeStandalonePath();
      registerStandaloneHandle(standalonePath, makeElectronHandle(result.absPath, result.name));
      dispatch({ type: "openFile", path: standalonePath, title: result.name });
      return;
    }

    if (!("showOpenFilePicker" in window)) {
      notify("Your browser doesn't support the File System Access API. Try Chrome or Edge.", {
        kind: "error",
      });
      return;
    }
    const picker = window.showOpenFilePicker as (opts: object) => Promise<FileSystemFileHandle[]>;
    try {
      const [fsaHandle] = await picker({
        types: [{ description: "Markdown files", accept: { "text/markdown": [".md"] } }],
        multiple: false,
      });
      const standalonePath = makeStandalonePath();
      registerStandaloneHandle(standalonePath, makeFsaHandle(fsaHandle));
      dispatch({ type: "openFile", path: standalonePath, title: fsaHandle.name });
    } catch (err) {
      // AbortError means the user canceled the picker — that's fine.
      if ((err as { name?: string }).name !== "AbortError") {
        notify("Couldn't open file.", { kind: "error" });
      }
    }
  }, [dispatch, notify]);

  const deletePath = useCallback(
    async (path: string) => {
      const name = path.split("/").pop() ?? path;
      try {
        markModified(path);
        await undoableFileOps.deleteFile(path);
        dispatch({ type: "closePath", path });
        await refreshTree();
        notify(`Deleted "${name}" (Ctrl+Z to undo)`, { kind: "info" });
      } catch {
        notify(`Couldn't delete "${name}"`, { kind: "error" });
      }
    },
    [dispatch, refreshTree, markModified, notify, undoableFileOps],
  );

  const openSettings = useCallback(() => {
    if (!openSettingsInTab) {
      setSettingsOpen((open) => !open);
      return;
    }
    // Tab mode: focus the settings tab, or close it if it's already focused.
    for (const pane of state.panes) {
      const tab = pane.tabs.find((candidate) => candidate.path === SETTINGS_TAB_PATH);
      if (!tab) {
        continue;
      }
      const focused = state.activePaneId === pane.id && pane.activeTabId === tab.id;
      if (focused) {
        dispatch({ type: "closeTab", paneId: pane.id, tabId: tab.id });
      } else {
        dispatch({ type: "focusPane", paneId: pane.id });
        dispatch({ type: "activateTab", paneId: pane.id, tabId: tab.id });
      }
      return;
    }
    dispatch({ type: "openFile", path: SETTINGS_TAB_PATH, title: "Settings" });
  }, [openSettingsInTab, state.panes, state.activePaneId, dispatch]);

  // Persist the preference and convert the currently-open surface live.
  const setOpenSettingsInTab = useCallback(
    (next: boolean) => {
      setOpenSettingsInTabState(next);
      globalThis.localStorage?.setItem("notes.settings.openInTab", String(next));
      if (next) {
        setSettingsOpen(false);
        dispatch({ type: "openFile", path: SETTINGS_TAB_PATH, title: "Settings" });
      } else {
        dispatch({ type: "closePath", path: SETTINGS_TAB_PATH });
        setSettingsOpen(true);
      }
    },
    [dispatch],
  );

  const setMediaDirectory = useCallback((value: string) => {
    const normalized = normalizeMediaDirectory(value);
    setMediaDirectoryState(normalized);
    globalThis.localStorage?.setItem("notes.settings.mediaDirectory", normalized);
  }, []);

  const setRenderedWidthDefault = useCallback((value: RenderedWidthSetting) => {
    setRenderedWidthDefaultState(value);
    globalThis.localStorage?.setItem(RENDERED_WIDTH_SETTING_KEY, value);
  }, []);

  const openTome = useCallback(() => {
    setTomeActive(true);
    void refreshTree();
    void loadExternalThemes().then(setExternalThemes);
  }, [refreshTree]);

  const closeTome = useCallback(() => {
    setTomeActive(false);
    dispatch({ type: "setTree", tree: [] });
  }, [dispatch]);

  const seededRef = useRef(false);
  useEffect(() => {
    if (!tomeActive) {
      // Even in standalone mode, load themes (they don't need the Tome).
      void loadExternalThemes().then(setExternalThemes);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshTree();
    // Load external themes on startup.
    void loadExternalThemes().then(setExternalThemes);
    // First-run onboarding: auto-seed a sample Tome exactly once.
    if (seededRef.current) {
      return;
    }
    seededRef.current = true;
    void (async () => {
      if (globalThis.localStorage?.getItem("notes.seeded")) {
        return;
      }
      const { entries } = await api.files();
      if (entries.length === 0) {
        globalThis.localStorage?.setItem("notes.seeded", "1");
        seedSampleNotes();
      }
    })();
  }, [refreshTree, seedSampleNotes, tomeActive]);

  useEffect(() => {
    applyTheme(state.theme);
    // When switching to a custom theme that specifies default fonts, apply them.
    const meta = externalThemes.find((t) => t.id === state.theme);
    if (meta) {
      // TODO: Subscribe to theme change events and set font families there
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFontFamilies((prev) => ({
        ...prev,
        app: meta.appFont ?? prev.app,
        editor: meta.editorFont ?? prev.editor,
      }));
    }
  }, [state.theme, externalThemes]);

  // Listen for files opened via OS file association (Electron only).
  useEffect(() => {
    const electronApi = window.electronAPI;
    if (!electronApi?.onOpenWithFile) {
      return;
    }
    return electronApi.onOpenWithFile((absPath: string) => {
      const name = absPath.split(/[\\/]/).pop() ?? absPath;
      const standalonePath = makeStandalonePath();
      registerStandaloneHandle(standalonePath, makeElectronHandle(absPath, name));
      dispatch({ type: "openFile", path: standalonePath, title: name });
    });
  }, [dispatch]);

  // Flush any offline-buffered writes on load and whenever connectivity returns.
  useEffect(() => {
    const sync = () => {
      if (pendingCount() === 0) {
        return;
      }
      void flushQueue(api.write).then((flushed) => {
        if (flushed > 0) {
          notify(`Synced ${flushed} offline change(s)`, { kind: "success" });
          void refreshTree();
        }
      });
    };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [notify, refreshTree]);

  // Prune restored/open tabs whose files no longer exist. Runs only when the
  // tree changes (not on tab edits) to avoid racing with rename/refresh.
  useEffect(() => {
    if (state.tree.length === 0) {
      return;
    }
    const existing = new Set(flattenFiles(state.tree).map((file) => file.path));
    for (const pane of state.panes) {
      for (const tab of pane.tabs) {
        if (
          !tab.path.startsWith("notes://") &&
          !isStandalonePath(tab.path) &&
          !existing.has(tab.path)
        ) {
          dispatch({ type: "closePath", path: tab.path });
        }
      }
    }
  }, [state.tree, state.panes, dispatch]);

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  useEffect(() => {
    applyFontSizes(fontSizes.app, fontSizes.editor);
  }, [fontSizes]);

  useEffect(() => {
    applyFontFamilies(fontFamilies.app, fontFamilies.editor);
  }, [fontFamilies]);

  // Query system fonts on mount via the Local Font Access API.
  useEffect(() => {
    void querySystemFonts().then(setFontFamilyOptions);
  }, []);

  const setAccent = useCallback((color: string) => setAccentState(color), []);
  const setAppFontSize = useCallback(
    (size: number) => setFontSizes((prev) => ({ ...prev, app: size })),
    [],
  );
  const setEditorFontSize = useCallback(
    (size: number) => setFontSizes((prev) => ({ ...prev, editor: size })),
    [],
  );
  const setAppFontFamily = useCallback(
    (family: string) => setFontFamilies((prev) => ({ ...prev, app: family })),
    [],
  );
  const setEditorFontFamily = useCallback(
    (family: string) => setFontFamilies((prev) => ({ ...prev, editor: family })),
    [],
  );

  useEffect(() => {
    if (!tomeActive) return;
    return connectTomeChanges((change) => {
      void refreshTree();
      dispatch({ type: "setStatus", status: `${change.kind}: ${change.path}` });
    });
  }, [refreshTree, dispatch, tomeActive]);

  // Discard provisional notes whose tab was closed without modification.
  useEffect(() => {
    const openPaths = new Set(state.panes.flatMap((pane) => pane.tabs.map((tab) => tab.path)));
    for (const path of [...provisional]) {
      if (!openPaths.has(path)) {
        // TODO: Subscribe to tab close events and cleanup provisional there
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setProvisional((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
        void api
          .remove(path)
          .then(() => refreshTree())
          .catch(() => undefined);
      }
    }
  }, [state.panes, refreshTree, provisional]);

  const commands = useMemo<AppCommand[]>(
    () => [
      {
        id: "command-palette",
        title: "Command palette",
        category: "Go",
        icon: "⌘",
        defaultHotkey: "Mod+P",
        run: () => setPaletteMode("commands"),
      },
      {
        id: "quick-open",
        title: "Quick open note",
        category: "Go",
        icon: "🔍",
        defaultHotkey: "Mod+O",
        run: () => setPaletteMode("files"),
      },
      {
        id: "open-standalone-file",
        title: "Open file (standalone)…",
        category: "File",
        icon: "📄",
        run: () => void openStandaloneFile(),
      },
      {
        id: "open-tome",
        title: "Load configured Tome",
        category: "File",
        icon: "📚",
        run: openTome,
      },
      {
        id: "close-tome",
        title: "Close Tome",
        category: "File",
        icon: "🗂️",
        run: closeTome,
      },
      {
        id: "open-settings",
        title: "Open settings",
        category: "Go",
        icon: "⚙",
        defaultHotkey: "Mod+,",
        run: openSettings,
      },
      {
        id: "new-note",
        title: "New note",
        category: "Create",
        defaultHotkey: "Mod+N",
        run: () => createNote(),
      },
      { id: "new-table", title: "New table", category: "Create", run: () => createTable() },
      { id: "new-canvas", title: "New canvas", category: "Create", run: () => createCanvas() },
      { id: "new-board", title: "New board", category: "Create", run: () => createBoard() },
      { id: "new-mermaid", title: "New diagram", category: "Create", run: () => createMermaid() },
      {
        id: "new-calendar",
        title: "New calendar",
        category: "Create",
        run: () => createCalendar(),
      },
      { id: "new-grid", title: "New grid", category: "Create", run: () => createGrid() },
      {
        id: "split-pane",
        title: "Split editor pane",
        category: "View",
        defaultHotkey: "Mod+\\",
        run: () => dispatch({ type: "splitPane", paneId: state.activePaneId, mode: "duplicate" }),
      },
      {
        id: "theme-light",
        title: "Light",
        category: "Theme",
        run: () => dispatch({ type: "setTheme", theme: "light" }),
      },
      {
        id: "theme-dark",
        title: "Dark",
        category: "Theme",
        run: () => dispatch({ type: "setTheme", theme: "dark" }),
      },
      {
        id: "theme-system",
        title: "System",
        category: "Theme",
        run: () => dispatch({ type: "setTheme", theme: "system" }),
      },
      {
        id: "reindex",
        title: "Rebuild search index",
        category: "Index",
        run: () => void api.reindex(),
      },
      {
        id: "replace-tome",
        title: "Find & replace in Tome",
        category: "Edit",
        run: () => setReplaceOpen(true),
      },
      {
        id: "help-shortcuts",
        title: "Keyboard shortcuts",
        category: "Help",
        icon: "❔",
        defaultHotkey: "Mod+/",
        run: () => setHelpOpen(true),
      },
      ...plugins.pluginCommands.map((command) => ({
        id: command.id,
        title: command.label,
        category: "Plugin",
        defaultHotkey: command.defaultHotkey,
        run: command.run,
      })),
    ],
    [
      dispatch,
      createNote,
      createTable,
      createCanvas,
      createBoard,
      createMermaid,
      createCalendar,
      createGrid,
      plugins.pluginCommands,
      state.activePaneId,
      openSettings,
      openStandaloneFile,
      openTome,
      closeTome,
    ],
  );

  const hotkeys = useHotkeys(commands);

  const flatFiles = useMemo(() => flattenFiles(state.tree), [state.tree]);

  const hotkeyFor = useCallback(
    (commandId: string): string | undefined => {
      const combo = hotkeys.comboFor(commandId);
      return combo ? formatCombo(combo, hotkeys.platform) : undefined;
    },
    [hotkeys],
  );

  const runCommand = useCallback((command: AppCommand) => {
    setRecentCommandIds((current) => pushRecentCommand(command.id, current));
    command.run();
  }, []);

  const openSidebarSearch = useCallback((query: string) => {
    setSidebarView("search");
    setSidebarSearchQuery(query);
  }, []);

  const clearRenameRequest = useCallback(() => {
    setRenameRequestPath(null);
  }, []);

  const newActions = useMemo(
    () => [
      { id: "note", label: "Markdown note", run: () => createNote() },
      { id: "table", label: "Table", run: () => createTable() },
      { id: "canvas", label: "Canvas", run: () => createCanvas() },
      { id: "board", label: "Board", run: () => createBoard() },
      { id: "mermaid", label: "Diagram (Mermaid)", run: () => createMermaid() },
      { id: "calendar", label: "Calendar", run: () => createCalendar() },
      { id: "grid", label: "Grid", run: () => createGrid() },
    ],
    [createNote, createTable, createCanvas, createBoard, createMermaid, createCalendar, createGrid],
  );

  const importDefaultThemes = useCallback(async () => {
    try {
      const { imported } = await api.importDefaultThemes();
      const themes = await loadExternalThemes();
      setExternalThemes(themes);
      if (imported.length > 0) {
        notify(`Imported ${imported.length} default theme(s)`, { kind: "success" });
      } else {
        notify("No bundled default themes were found to import", { kind: "error" });
      }
    } catch {
      notify("Failed to import default themes", { kind: "error" });
    }
  }, [notify]);

  const installPlugin = useCallback(
    async (zipFile: File) => {
      try {
        const buffer = await zipFile.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunk = 8192;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        const contentBase64 = btoa(binary);
        const { manifest } = await api.installPlugin(contentBase64);
        setPendingRestartPlugins((prev) => [...prev.filter((m) => m.id !== manifest.id), manifest]);
        notify(`Plugin "${manifest.name}" installed.`, {
          kind: "success",
          timeout: 0,
          action: { label: "Restart now", run: () => window.location.reload() },
        });
      } catch (err) {
        notify(`Plugin install failed: ${err instanceof Error ? err.message : String(err)}`, {
          kind: "error",
        });
      }
    },
    [notify],
  );

  const settingsProps = useMemo<SettingsBodyProps>(
    () => ({
      plugins: plugins.list,
      onToggle: plugins.toggle,
      onInstallPlugin: installPlugin,
      pendingRestartPlugins,
      onRestart: () => window.location.reload(),
      theme: state.theme,
      onThemeChange: (theme) => dispatch({ type: "setTheme", theme }),
      accent,
      accentPresets: ACCENT_PRESETS,
      onAccentChange: setAccent,
      appFontSize: fontSizes.app,
      editorFontSize: fontSizes.editor,
      onAppFontSizeChange: setAppFontSize,
      onEditorFontSizeChange: setEditorFontSize,
      appFontFamily: fontFamilies.app,
      editorFontFamily: fontFamilies.editor,
      fontFamilyOptions: buildFontFamilyOptions(
        fontFamilyOptions,
        externalThemes.find((t) => t.id === state.theme)?.appFont,
      ),
      onAppFontFamilyChange: setAppFontFamily,
      onEditorFontFamilyChange: setEditorFontFamily,
      openInTab: openSettingsInTab,
      onOpenInTabChange: setOpenSettingsInTab,
      mediaDirectory,
      onMediaDirectoryChange: setMediaDirectory,
      renderedWidthDefault,
      onRenderedWidthDefaultChange: setRenderedWidthDefault,
      externalThemes,
      onImportDefaultThemes: importDefaultThemes,
      tomePluginsPath: plugins.tomePluginsPath,
      hotkeys: {
        commands: commands.map((command) => ({
          id: command.id,
          title: command.title,
          category: command.category,
        })),
        comboFor: hotkeys.comboFor,
        format: (combo) => formatCombo(combo, hotkeys.platform),
        isCustom: hotkeys.isCustom,
        rebind: hotkeys.rebind,
        reset: hotkeys.reset,
        conflicts: hotkeys.conflicts,
      },
    }),
    [
      plugins.list,
      plugins.toggle,
      installPlugin,
      pendingRestartPlugins,
      state.theme,
      dispatch,
      accent,
      setAccent,
      fontSizes,
      setAppFontSize,
      setEditorFontSize,
      fontFamilies,
      fontFamilyOptions,
      setAppFontFamily,
      setEditorFontFamily,
      openSettingsInTab,
      setOpenSettingsInTab,
      mediaDirectory,
      setMediaDirectory,
      renderedWidthDefault,
      setRenderedWidthDefault,
      externalThemes,
      importDefaultThemes,
      plugins.tomePluginsPath,
      commands,
      hotkeys,
    ],
  );

  const services = useMemo(
    () => ({
      markModified,
      renamePath,
      deletePath,
      createNote,
      createTable,
      createCanvas,
      createBoard,
      createMermaid,
      createCalendar,
      createGrid,
      seedSampleNotes,
      noteTypes,
      setActiveDocument: (doc: { path: string; content: string; type: string } | null) =>
        plugins.documentSignal.set(doc),
      fileHandlers: plugins.fileHandlers,
      noteTypeRegistry,
      settings: settingsProps,
      undoableFileOps,
    }),
    [
      markModified,
      renamePath,
      deletePath,
      createNote,
      createTable,
      createCanvas,
      createBoard,
      createMermaid,
      createCalendar,
      createGrid,
      seedSampleNotes,
      noteTypes,
      plugins.documentSignal,
      plugins.fileHandlers,
      noteTypeRegistry,
      settingsProps,
      undoableFileOps,
    ],
  );

  return (
    <AppServicesProvider value={services}>
      <div className="app-root">
        <UpdateBanner />
        <div className="shell">
          <Ribbon
            newActions={newActions}
            onCommand={() => setPaletteMode("commands")}
            onSearch={openSidebarSearch}
            onOpenFile={() => void openStandaloneFile()}
            tomeActive={tomeActive}
            onCloseTome={closeTome}
            onOpenTome={openTome}
          />
          <div className="shell-body">
            <Sidebar
              view={sidebarView}
              onViewChange={setSidebarView}
              onOpenPicker={() => setPaletteMode("files")}
              searchQuery={sidebarSearchQuery}
              renameRequestPath={renameRequestPath}
              onRenameRequestHandled={clearRenameRequest}
              tomeActive={tomeActive}
              onOpenTome={openTome}
            />
            <Workspace />
            <RightPanel />
          </div>
          <StatusBar
            pluginItems={plugins.statusItems}
            theme={state.theme}
            externalThemes={externalThemes}
            onThemeChange={(theme) => dispatch({ type: "setTheme", theme })}
            onOpenSettings={openSettings}
          />
          {paletteMode && (
            <Palette
              mode={paletteMode}
              files={flatFiles}
              commands={commands}
              recentCommandIds={recentCommandIds}
              hotkeyFor={hotkeyFor}
              onOpenFile={(path, title) => dispatch({ type: "openFile", path, title })}
              onRunCommand={runCommand}
              onCreateNote={createNamedNote}
              onClose={() => setPaletteMode(null)}
            />
          )}
          {settingsOpen && (
            <SettingsModal {...settingsProps} onClose={() => setSettingsOpen(false)} />
          )}
          {helpOpen && (
            <HelpOverlay
              commands={settingsProps.hotkeys.commands}
              hotkeyFor={hotkeyFor}
              onClose={() => setHelpOpen(false)}
            />
          )}
          {replaceOpen && (
            <TomeReplace
              onClose={() => setReplaceOpen(false)}
              onChanged={() => void refreshTree()}
            />
          )}
          <Toaster />
        </div>
      </div>
    </AppServicesProvider>
  );
}
