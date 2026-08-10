import type { NoteTypeProvider, NoteViewRegistry, NoteViewDisposer } from "@notes/core";
import { MermaidView } from "./mermaid-view";

export const MERMAID_NOTE_TYPE_ID = "mermaid";

/** Mermaid notes are `.md` files with `type: mermaid` frontmatter. */
export const mermaidNoteType: NoteTypeProvider = {
  id: MERMAID_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "mermaid";
  },
  supportedModes: ["edit", "split", "rendered"],
  sourceProtected: false,
  supportsScrollSync: false,
  viewComponent: MermaidView,
};

/** Registers the mermaid note type with the NoteViewRegistry — mirrors the plugin pattern. */
export function registerBuiltinNoteView(registry: NoteViewRegistry): NoteViewDisposer {
  return registry.register(mermaidNoteType);
}
