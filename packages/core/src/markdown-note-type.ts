import type { NoteFileDescriptor, NoteTypeProvider } from "./contracts";

export const MARKDOWN_NOTE_TYPE_ID = "markdown";

/** Default note type — any `.md` file that isn't claimed by a more specific type. */
export const markdownNoteType: NoteTypeProvider = {
  id: MARKDOWN_NOTE_TYPE_ID,
  detect(file: NoteFileDescriptor): boolean {
    return file.path.toLowerCase().endsWith(".md");
  },
};
