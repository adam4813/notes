import type { NoteTypeRegistry } from "@notes/core";
import type { NoteTypeViewDescriptor } from "@notes/editor";
import { CanvasView } from "./canvas-view";

export const CANVAS_NOTE_TYPE_ID = "canvas";

/** Canvas notes are `.canvas` files (JSONCanvas). */
export const canvasNoteType: NoteTypeViewDescriptor = {
  id: CANVAS_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".canvas");
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: CanvasView,
};

/** Registers the canvas note type with the NoteTypeRegistry — mirrors the plugin pattern. */
export function registerBuiltinNoteType(registry: NoteTypeRegistry): () => void {
  return registry.register(canvasNoteType);
}
