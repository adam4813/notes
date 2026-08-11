/**
 * React-typed narrowing helpers and typed descriptor interface for note types.
 *
 * packages/core is React-free, so NoteTypeDescriptor uses `unknown` for its
 * React-specific fields. This module provides:
 *   - NoteTypeViewDescriptor — a typed variant of NoteTypeDescriptor with
 *     properly typed viewComponent, toolbarItems, and contextMenuBuilder.
 *   - Accessor helpers (getNoteViewComponent etc.) for the opaque core fields.
 */
import type { NoteTypeDescriptor, NoteTypeToolbarItem } from "@notes/core";
import type { ComponentType, ReactNode } from "react";
import type { NoteViewContextMenuBuilder, ContextMenuEntry } from "@notes/ui";
import type { RendererProps } from "./types";

export type NoteViewComponent = ComponentType<RendererProps>;

export interface TypedNoteTypeToolbarItem extends Omit<NoteTypeToolbarItem, "element"> {
  element: ReactNode;
}

// Re-export for convenience so consumers don't need to import from both packages.
export type { NoteViewContextMenuBuilder, ContextMenuEntry };

/**
 * NoteTypeDescriptor with React-typed fields. Use this when creating a
 * descriptor in note-* packages so TypeScript enforces the correct component
 * and toolbar types at registration time.
 *
 * Assignable to NoteTypeDescriptor (the base type), so it can be passed
 * directly to NoteTypeRegistry.register().
 */
export interface NoteTypeViewDescriptor extends Omit<
  NoteTypeDescriptor,
  "viewComponent" | "toolbarItems" | "contextMenuBuilder"
> {
  viewComponent?: NoteViewComponent;
  toolbarItems?: TypedNoteTypeToolbarItem[];
  contextMenuBuilder?: NoteViewContextMenuBuilder;
}

/** Extract the viewComponent from a descriptor (casts the opaque unknown field). */
export function getNoteViewComponent(
  descriptor: NoteTypeDescriptor,
): NoteViewComponent | undefined {
  return descriptor.viewComponent as NoteViewComponent | undefined;
}

/** Extract and cast toolbarItems to typed ReactNode elements. */
export function getNoteViewToolbarItems(
  descriptor: NoteTypeDescriptor,
): TypedNoteTypeToolbarItem[] {
  return (descriptor.toolbarItems ?? []) as TypedNoteTypeToolbarItem[];
}

/** Extract and cast the opaque contextMenuBuilder to a typed function. */
export function getNoteContextMenuBuilder(
  descriptor: NoteTypeDescriptor,
): NoteViewContextMenuBuilder | undefined {
  return descriptor.contextMenuBuilder as NoteViewContextMenuBuilder | undefined;
}
