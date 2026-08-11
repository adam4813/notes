import type { NoteTypeDescriptor } from "@notes/editor";
import { CanvasView } from "./canvas-view";

export const CANVAS_NOTE_TYPE_ID = "canvas";

/** Canvas notes are `.canvas` files (JSONCanvas). */
export const canvasNoteType: NoteTypeDescriptor = {
  id: CANVAS_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".canvas");
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: CanvasView,
};
