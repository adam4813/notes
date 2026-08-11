import type { NoteTypeDescriptor } from "@notes/editor";
import { TableGrid } from "./table-grid";

export const TABLE_NOTE_TYPE_ID = "table";

/** Table notes are `.md` files with `type: table` frontmatter. */
export const tableNoteType: NoteTypeDescriptor = {
  id: TABLE_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "table";
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: TableGrid,
};
