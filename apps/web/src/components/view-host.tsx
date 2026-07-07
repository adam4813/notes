import { useAppServices } from "../state/app-services";
import { NoteEditor } from "./note-editor";
import { SETTINGS_TAB_PATH, SettingsView } from "./settings-view";

/** Routes a tab to its view. Special paths render app surfaces; else a note. */
export function ViewHost({ path }: { path: string }) {
  const { settings } = useAppServices();

  if (path === SETTINGS_TAB_PATH) {
    return <SettingsView {...settings} />;
  }

  return <NoteEditor path={path} />;
}
