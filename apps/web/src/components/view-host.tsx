import { useAppServices } from "../state/app-services";
import { useWorkspace } from "../state/app-context";
import { NoteEditor } from "./note-editor";
import { SETTINGS_TAB_PATH, SettingsView } from "./settings-view";

/** Routes a tab to its view. Special paths render app surfaces; else a note. */
export function ViewHost({ path }: { path: string }) {
  const { state } = useWorkspace();
  const { plugins, openSettingsInTab, setOpenSettingsInTab } = useAppServices();

  if (path === SETTINGS_TAB_PATH) {
    return (
      <SettingsView
        plugins={plugins.list}
        theme={state.theme}
        onToggle={plugins.toggle}
        openInTab={openSettingsInTab}
        onOpenInTabChange={setOpenSettingsInTab}
      />
    );
  }

  return <NoteEditor path={path} />;
}
