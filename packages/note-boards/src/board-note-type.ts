import type { NoteTypeRegistry } from "@notes/core";
import type { NoteTypeViewDescriptor } from "@notes/editor";
import { BoardView } from "./board-view";

export const BOARD_NOTE_TYPE_ID = "board";

/** Board notes are `.md` files with `type: board` frontmatter. */
export const boardNoteType: NoteTypeViewDescriptor = {
  id: BOARD_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "board";
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: BoardView,
};

/** Registers the board note type with the NoteTypeRegistry — mirrors the plugin pattern. */
export function registerBuiltinNoteType(registry: NoteTypeRegistry): () => void {
  return registry.register(boardNoteType);
}
