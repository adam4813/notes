import type { NoteTypeProvider, NoteViewRegistry, NoteViewDisposer } from "@notes/core";
import { BoardView } from "./board-view";

export const BOARD_NOTE_TYPE_ID = "board";

/** Board notes are `.md` files with `type: board` frontmatter. */
export const boardNoteType: NoteTypeProvider = {
  id: BOARD_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "board";
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: BoardView,
};

/** Registers the board note type with the NoteViewRegistry — mirrors the plugin pattern. */
export function registerBuiltinNoteView(registry: NoteViewRegistry): NoteViewDisposer {
  return registry.register(boardNoteType);
}
