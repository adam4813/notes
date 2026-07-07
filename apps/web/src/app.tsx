import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emptyCanvas } from "@notes/note-canvas";
import { emptyBoard } from "@notes/note-boards";
import { emptyTableMarkdown } from "@notes/note-tables";
import { api, type FileEntry } from "./api/client";
import { connectTomeChanges } from "./api/ws";
import { Palette, type PaletteCommand } from "./components/palette";
import { RightPanel } from "./components/right-panel";
import { Ribbon } from "./components/ribbon";
import { SettingsModal } from "./components/settings-modal";
import { SETTINGS_TAB_PATH } from "./components/settings-view";
import { Sidebar } from "./components/sidebar";
import { StatusBar } from "./components/status-bar";
import { Workspace } from "./components/workspace";
import { AppServicesProvider } from "./state/app-services";
import { useWorkspace } from "./state/app-context";
import { usePlugins } from "./state/use-plugins";
import { flattenFiles } from "./state/selectors";
import { applyTheme } from "./theme/theme";

type PaletteMode = "files" | "commands" | null;

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
  const [paletteMode, setPaletteMode] = useState<PaletteMode>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openSettingsInTab, setOpenSettingsInTabState] = useState(
    () => globalThis.localStorage?.getItem("notes.settings.openInTab") === "true",
  );
  const plugins = usePlugins();
  const treeRef = useRef(state.tree);
  treeRef.current = state.tree;
  // Paths of freshly-created notes not yet modified/named (discarded on close).
  const provisionalRef = useRef<Set<string>>(new Set());

  const refreshTree = useCallback(async () => {
    const { entries } = await api.files();
    dispatch({ type: "setTree", tree: entries });
  }, [dispatch]);

  const createOfType = useCallback(
    (base: string, ext: string, contentFor: (name: string) => string, dir?: string) => {
      void (async () => {
        const path = nextName(dir ?? "", base, ext, treeRef.current);
        await api.create(path, contentFor(baseNoExt(path)));
        provisionalRef.current.add(path);
        await refreshTree();
        dispatch({ type: "openFile", path, title: baseNoExt(path) });
      })();
    },
    [dispatch, refreshTree],
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

  const markModified = useCallback((path: string) => {
    provisionalRef.current.delete(path);
  }, []);

  const openSettings = useCallback(() => {
    if (openSettingsInTab) {
      dispatch({ type: "openFile", path: SETTINGS_TAB_PATH, title: "Settings" });
    } else {
      setSettingsOpen(true);
    }
  }, [openSettingsInTab, dispatch]);

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

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    applyTheme(state.theme);
  }, [state.theme]);

  useEffect(() => {
    return connectTomeChanges((change) => {
      void refreshTree();
      dispatch({ type: "setStatus", status: `${change.kind}: ${change.path}` });
    });
  }, [refreshTree, dispatch]);

  // Discard provisional notes whose tab was closed without modification.
  useEffect(() => {
    const openPaths = new Set(state.panes.flatMap((pane) => pane.tabs.map((tab) => tab.path)));
    for (const path of [...provisionalRef.current]) {
      if (!openPaths.has(path)) {
        provisionalRef.current.delete(path);
        void api
          .remove(path)
          .then(() => refreshTree())
          .catch(() => undefined);
      }
    }
  }, [state.panes, refreshTree]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPaletteMode("commands");
      } else if (mod && event.key.toLowerCase() === "o") {
        event.preventDefault();
        setPaletteMode("files");
      } else if (event.key === "Escape") {
        setPaletteMode(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commands = useMemo<PaletteCommand[]>(
    () => [
      { id: "theme-light", label: "Theme: Light", run: () => dispatch({ type: "setTheme", theme: "light" }) },
      { id: "theme-dark", label: "Theme: Dark", run: () => dispatch({ type: "setTheme", theme: "dark" }) },
      { id: "theme-system", label: "Theme: System", run: () => dispatch({ type: "setTheme", theme: "system" }) },
      {
        id: "split-pane",
        label: "Split editor pane",
        run: () => dispatch({ type: "splitPane", paneId: state.activePaneId, mode: "duplicate" }),
      },
      { id: "new-note", label: "New note", run: () => createNote() },
      { id: "new-table", label: "New table", run: () => createTable() },
      { id: "new-canvas", label: "New canvas", run: () => createCanvas() },
      { id: "new-board", label: "New board", run: () => createBoard() },
      { id: "reindex", label: "Rebuild search index", run: () => void api.reindex() },
      { id: "open-settings", label: "Open settings", run: openSettings },
      ...plugins.pluginCommands.map((command) => ({
        id: command.id,
        label: command.label,
        run: command.run,
      })),
    ],
    [dispatch, createNote, createTable, createCanvas, createBoard, plugins.pluginCommands, state.activePaneId, openSettings],
  );

  const newActions = useMemo(
    () => [
      { id: "note", label: "Markdown note", run: () => createNote() },
      { id: "table", label: "Table", run: () => createTable() },
      { id: "canvas", label: "Canvas", run: () => createCanvas() },
      { id: "board", label: "Board", run: () => createBoard() },
    ],
    [createNote, createTable, createCanvas, createBoard],
  );

  const services = useMemo(
    () => ({
      markModified,
      createNote,
      createTable,
      createCanvas,
      createBoard,
      setActiveDocument: (doc: { path: string; content: string; type: string } | null) =>
        plugins.documentSignal.set(doc),
      plugins: { list: plugins.list, toggle: plugins.toggle },
      openSettingsInTab,
      setOpenSettingsInTab,
    }),
    [
      markModified,
      createNote,
      createTable,
      createCanvas,
      createBoard,
      plugins.documentSignal,
      plugins.list,
      plugins.toggle,
      openSettingsInTab,
      setOpenSettingsInTab,
    ],
  );

  return (
    <AppServicesProvider value={services}>
      <div className="shell">
        <Ribbon
          onNewNote={() => createNote()}
          onCommand={() => setPaletteMode("commands")}
          onQuickOpen={() => setPaletteMode("files")}
          onSettings={openSettings}
        />
        <div className="shell-body">
          <Sidebar newActions={newActions} />
          <Workspace />
          <RightPanel />
        </div>
        <StatusBar pluginItems={plugins.statusItems} />
        {paletteMode && (
          <Palette
            mode={paletteMode}
            files={flattenFiles(state.tree)}
            commands={commands}
            onOpenFile={(path, title) => dispatch({ type: "openFile", path, title })}
            onClose={() => setPaletteMode(null)}
          />
        )}
        {settingsOpen && (
          <SettingsModal
            plugins={plugins.list}
            theme={state.theme}
            onToggle={plugins.toggle}
            openInTab={openSettingsInTab}
            onOpenInTabChange={setOpenSettingsInTab}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>
    </AppServicesProvider>
  );
}
