/**
 * Registers the built-in markdown note type with the NoteViewRegistry.
 *
 * This lives in packages/editor (not packages/core) because the markdown
 * NoteTypeProvider needs to reference RenderedEditor — a React component —
 * and packages/core must remain React-free.
 */
import { markdownNoteType, type NoteViewRegistry, type NoteViewDisposer } from "@notes/core";
import { RenderedEditor } from "./rendered-editor";

export function registerMarkdownNoteView(registry: NoteViewRegistry): NoteViewDisposer {
  return registry.register({
    ...markdownNoteType,
    viewComponent: RenderedEditor,
  });
}
