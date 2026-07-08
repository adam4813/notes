import type { NoteTypeProvider } from "@notes/core";

export const GRID_NOTE_TYPE_ID = "grid";

/** Grid notes are `.md` files with `type: grid` frontmatter. */
export const gridNoteType: NoteTypeProvider = {
  id: GRID_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "grid";
  },
};
