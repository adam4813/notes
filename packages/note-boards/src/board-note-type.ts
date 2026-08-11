import type { NoteTypeDescriptor } from "@notes/editor";
import { BoardView } from "./board-view";

export const BOARD_NOTE_TYPE_ID = "board";

/** Board notes are `.md` files with `type: board` frontmatter. */
export const boardNoteType: NoteTypeDescriptor = {
  id: BOARD_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "board";
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: BoardView,
};
