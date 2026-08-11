import type { NoteTypeDescriptor } from "@notes/editor";
import { RenderedEditor } from "./rendered-editor";

export const MARKDOWN_NOTE_TYPE_ID = "markdown";

/** Complete descriptor for the built-in markdown note type. */
export const markdownNoteType: NoteTypeDescriptor = {
  id: MARKDOWN_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md");
  },
  supportedModes: ["edit", "split", "rendered"],
  sourceProtected: false,
  supportsScrollSync: true,
  viewComponent: RenderedEditor,
};
