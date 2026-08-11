/**
 * Registers the built-in markdown note type with the NoteTypeRegistry.
 *
 * This lives in packages/editor (not packages/core) because the markdown
 * NoteTypeDescriptor needs to reference RenderedEditor — a React component —
 * and packages/core must remain React-free.
 */
import { markdownNoteType, type NoteTypeRegistry } from "@notes/core";
import { RenderedEditor } from "./rendered-editor";
import type { NoteTypeViewDescriptor } from "./note-view-descriptor";

export function registerMarkdownNoteType(registry: NoteTypeRegistry): () => void {
  const descriptor: NoteTypeViewDescriptor = {
    id: markdownNoteType.id,
    detect: markdownNoteType.detect.bind(markdownNoteType),
    supportedModes: markdownNoteType.supportedModes,
    sourceProtected: markdownNoteType.sourceProtected,
    supportsScrollSync: markdownNoteType.supportsScrollSync,
    viewComponent: RenderedEditor,
  };
  return registry.register(descriptor);
}
