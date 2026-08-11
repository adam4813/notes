import type { NoteTypeDescriptor } from "@notes/editor";
import { GridView } from "./grid-view";

export const GRID_NOTE_TYPE_ID = "grid";

/** Grid notes are `.md` files with `type: grid` frontmatter. */
export const gridNoteType: NoteTypeDescriptor = {
  id: GRID_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "grid";
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: GridView,
};
