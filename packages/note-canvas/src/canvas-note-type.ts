import type { NoteTypeProvider } from "@notes/core";

export const CANVAS_NOTE_TYPE_ID = "canvas";

/** Canvas notes are `.canvas` files (JSONCanvas). */
export const canvasNoteType: NoteTypeProvider = {
  id: CANVAS_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".canvas");
  },
};
