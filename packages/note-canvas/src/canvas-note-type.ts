import type { NoteTypeProvider, NoteViewRegistry, NoteViewDisposer } from "@notes/core";
import { CanvasView } from "./canvas-view";

export const CANVAS_NOTE_TYPE_ID = "canvas";

/** Canvas notes are `.canvas` files (JSONCanvas). */
export const canvasNoteType: NoteTypeProvider = {
  id: CANVAS_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".canvas");
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: CanvasView,
};

/** Registers the canvas note type with the NoteViewRegistry — mirrors the plugin pattern. */
export function registerBuiltinNoteView(registry: NoteViewRegistry): NoteViewDisposer {
  return registry.register(canvasNoteType);
}
