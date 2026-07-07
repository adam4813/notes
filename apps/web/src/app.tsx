import { useCallback, useEffect, useMemo, useState } from "react";
import { emptyTableMarkdown } from "@notes/note-tables";
import { api } from "./api/client";
import { connectTomeChanges } from "./api/ws";
import { Palette, type PaletteCommand } from "./components/palette";
import { RightPanel } from "./components/right-panel";
import { Ribbon } from "./components/ribbon";
import { Sidebar } from "./components/sidebar";
import { StatusBar } from "./components/status-bar";
import { Workspace } from "./components/workspace";
import { useWorkspace } from "./state/app-context";
import { flattenFiles } from "./state/selectors";
import { applyTheme } from "./theme/theme";

type PaletteMode = "files" | "commands" | null;

export function App() {
  const { state, dispatch } = useWorkspace();
  const [paletteMode, setPaletteMode] = useState<PaletteMode>(null);

  const refreshTree = useCallback(async () => {
    const { entries } = await api.files();
    dispatch({ type: "setTree", tree: entries });
  }, [dispatch]);

  const createNote = useCallback(async () => {
    const name = `untitled-${Date.now()}.md`;
    await api.create(name, `# ${name.replace(/\.md$/, "")}\n\n`);
    await refreshTree();
    dispatch({ type: "openFile", path: name, title: name.replace(/\.md$/, "") });
  }, [dispatch, refreshTree]);

  const createTable = useCallback(async () => {
    const name = `table-${Date.now()}.md`;
    await api.create(name, emptyTableMarkdown());
    await refreshTree();
    dispatch({ type: "openFile", path: name, title: name.replace(/\.md$/, "") });
  }, [dispatch, refreshTree]);

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
      { id: "split-pane", label: "Split editor pane", run: () => dispatch({ type: "splitPane", paneId: state.activePaneId, mode: "duplicate" }) },
      { id: "new-note", label: "New note", run: () => void createNote() },
      { id: "new-table", label: "New table", run: () => void createTable() },
      { id: "reindex", label: "Rebuild search index", run: () => void api.reindex() },
    ],
    [dispatch, createNote, createTable, state.activePaneId],
  );

  return (
    <div className="shell">
      <Ribbon
        onNewNote={() => void createNote()}
        onCommand={() => setPaletteMode("commands")}
        onQuickOpen={() => setPaletteMode("files")}
      />
      <div className="shell-body">
        <Sidebar onNewNote={() => void createNote()} />
        <Workspace />
        <RightPanel />
      </div>
      <StatusBar />
      {paletteMode && (
        <Palette
          mode={paletteMode}
          files={flattenFiles(state.tree)}
          commands={commands}
          onOpenFile={(path, title) => dispatch({ type: "openFile", path, title })}
          onClose={() => setPaletteMode(null)}
        />
      )}
    </div>
  );
}
