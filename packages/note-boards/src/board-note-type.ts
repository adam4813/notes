import type { NoteTypeProvider } from "@notes/core";

export const BOARD_NOTE_TYPE_ID = "board";

/** Board notes are `.md` files with `type: board` frontmatter. */
export const boardNoteType: NoteTypeProvider = {
  id: BOARD_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "board";
  },
};
