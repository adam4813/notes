import type { NoteTypeProvider, NoteViewRegistry, NoteViewDisposer } from "@notes/core";
import { TableGrid } from "./table-grid";

export const TABLE_NOTE_TYPE_ID = "table";

/** Table notes are `.md` files with `type: table` frontmatter. */
export const tableNoteType: NoteTypeProvider = {
  id: TABLE_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "table";
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: TableGrid,
};

/** Registers the table note type with the NoteViewRegistry — mirrors the plugin pattern. */
export function registerBuiltinNoteView(registry: NoteViewRegistry): NoteViewDisposer {
  return registry.register(tableNoteType);
}
