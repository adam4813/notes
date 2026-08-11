import type { NoteTypeRegistry } from "@notes/core";
import type { NoteTypeViewDescriptor } from "@notes/editor";
import { TableGrid } from "./table-grid";

export const TABLE_NOTE_TYPE_ID = "table";

/** Table notes are `.md` files with `type: table` frontmatter. */
export const tableNoteType: NoteTypeViewDescriptor = {
  id: TABLE_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "table";
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: TableGrid,
};

/** Registers the table note type with the NoteTypeRegistry — mirrors the plugin pattern. */
export function registerBuiltinNoteType(registry: NoteTypeRegistry): () => void {
  return registry.register(tableNoteType);
}
