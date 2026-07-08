import type { NoteTypeProvider } from "@notes/core";

export const MERMAID_NOTE_TYPE_ID = "mermaid";

/** Mermaid notes are `.md` files with `type: mermaid` frontmatter. */
export const mermaidNoteType: NoteTypeProvider = {
  id: MERMAID_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "mermaid";
  },
};
