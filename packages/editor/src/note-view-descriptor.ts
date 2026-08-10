/**
 * React-typed narrowing helpers for the opaque UI capability fields on
 * NoteTypeProvider. Because packages/core is React-free, these fields are
 * typed as `unknown` there; this module provides safe cast helpers for the
 * editor/UI layer where React is available.
 */
import type { NoteTypeProvider, NoteTypeToolbarItem } from "@notes/core";
import type { ComponentType, ReactNode } from "react";
import type { NoteViewContextMenuBuilder, ContextMenuEntry } from "@notes/ui";
import type { RendererProps } from "./markdown-editor";

export type NoteViewComponent = ComponentType<RendererProps>;

export interface TypedNoteTypeToolbarItem extends Omit<NoteTypeToolbarItem, "element"> {
  element: ReactNode;
}

// Re-export for convenience so consumers don't need to import from both packages.
export type { NoteViewContextMenuBuilder, ContextMenuEntry };

/** Extract and cast the opaque viewComponent to a typed React component. */
export function getNoteViewComponent(provider: NoteTypeProvider): NoteViewComponent | undefined {
  return provider.viewComponent as NoteViewComponent | undefined;
}

/** Extract and cast toolbarItems to typed ReactNode elements. */
export function getNoteViewToolbarItems(provider: NoteTypeProvider): TypedNoteTypeToolbarItem[] {
  return (provider.toolbarItems ?? []) as TypedNoteTypeToolbarItem[];
}

/** Extract and cast the opaque contextMenuBuilder to a typed function. */
export function getNoteContextMenuBuilder(
  provider: NoteTypeProvider,
): NoteViewContextMenuBuilder | undefined {
  return provider.contextMenuBuilder as NoteViewContextMenuBuilder | undefined;
}
