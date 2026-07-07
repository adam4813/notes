import type { NoteTypeProvider } from "@notes/core";

export const TABLE_NOTE_TYPE_ID = "table";

/** Table notes are `.md` files with `type: table` frontmatter. */
export const tableNoteType: NoteTypeProvider = {
  id: TABLE_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "table";
  },
};
