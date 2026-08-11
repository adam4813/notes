import type { NoteTypeDescriptor } from "@notes/editor";
import { MermaidView } from "./mermaid-view";

export const MERMAID_NOTE_TYPE_ID = "mermaid";

/** Mermaid notes are `.md` files with `type: mermaid` frontmatter. */
export const mermaidNoteType: NoteTypeDescriptor = {
  id: MERMAID_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "mermaid";
  },
  supportedModes: ["edit", "split", "rendered"],
  sourceProtected: false,
  supportsScrollSync: false,
  viewComponent: MermaidView,
};
