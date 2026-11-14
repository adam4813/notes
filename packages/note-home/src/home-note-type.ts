import type { NoteTypeDescriptor } from "@notes/editor";
import { HomeView } from "./home-view";

export const HOME_NOTE_TYPE_ID = "home";

/** Homepage notes are `.md` files with `type: home` frontmatter. */
export const homeNoteType: NoteTypeDescriptor = {
  id: HOME_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "home";
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: HomeView,
};
