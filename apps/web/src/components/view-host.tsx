import { useCallback } from "react";
import { useAppServices } from "../state/app-services";
import { NoteEditor } from "./note-editor";
import { SETTINGS_TAB_PATH, SettingsView } from "./settings-view";
import { getStandaloneHandle, isStandalonePath } from "../lib/standalone-handles";

function StandaloneNoteEditorWrapper({ path }: { path: string }) {
  const handle = getStandaloneHandle(path);

  const readFn = useCallback(async () => {
    if (!handle) throw new Error("No file handle");
    return handle.read();
  }, [handle]);

  const writeFn = useCallback(
    async (content: string) => {
      if (!handle) throw new Error("No file handle");
      await handle.write(content);
    },
    [handle],
  );

  if (!handle) {
    return <div className="note-loading">Failed to load — please reopen the file.</div>;
  }

  return <NoteEditor path={path} readFn={readFn} writeFn={writeFn} isStandalone />;
}

/** Routes a tab to its view. Special paths render app surfaces; else a note. */
export function ViewHost({ path }: { path: string }) {
  const { settings } = useAppServices();

  if (path === SETTINGS_TAB_PATH) {
    return <SettingsView {...settings} />;
  }

  if (isStandalonePath(path)) {
    return <StandaloneNoteEditorWrapper path={path} />;
  }

  return <NoteEditor path={path} />;
}
