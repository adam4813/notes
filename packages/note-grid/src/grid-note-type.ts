import type { NoteTypeProvider, NoteViewRegistry, NoteViewDisposer } from "@notes/core";
import { GridView } from "./grid-view";

export const GRID_NOTE_TYPE_ID = "grid";

/** Grid notes are `.md` files with `type: grid` frontmatter. */
export const gridNoteType: NoteTypeProvider = {
  id: GRID_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "grid";
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: GridView,
};

/** Registers the grid note type with the NoteViewRegistry — mirrors the plugin pattern. */
export function registerBuiltinNoteView(registry: NoteViewRegistry): NoteViewDisposer {
  return registry.register(gridNoteType);
}
