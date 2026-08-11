/**
 * NoteTypeDescriptor — the complete description of a note type.
 *
 * This is the single interface used everywhere in the editor layer. It extends
 * the minimal NoteTypeDetector from packages/core (which only carries id +
 * detect for server-side file-type detection) with all client-side view
 * capabilities, properly typed with React types.
 *
 * There is no separate "view descriptor" — every note type is described by
 * NoteTypeDescriptor from the moment it is registered.
 */
import type { NoteTypeDetector } from "@notes/core";
import type { ComponentType, ReactNode } from "react";
import type { NoteViewContextMenuBuilder, ContextMenuEntry } from "@notes/ui";
import type { EditorMode, RendererProps } from "./types";

export type NoteViewComponent = ComponentType<RendererProps>;

/** A toolbar item contributed by a note type, with element typed as ReactNode. */
export interface NoteTypeToolbarItem {
  /** Unique id, e.g. "canvas.zoom-in". */
  id: string;
  /**
   * When set, replaces the built-in toolbar button with this id.
   * When omitted, the item is appended after the built-in buttons.
   */
  replace?: string;
  element: ReactNode;
}

// Re-export for convenience.
export type { NoteViewContextMenuBuilder, ContextMenuEntry };

/**
 * Complete descriptor for a note type (id, detect, and all view capabilities).
 *
 * This is the one type to use when defining or registering a note type.
 * Register with NoteTypeRegistry<NoteTypeDescriptor> client-side, or pass to
 * a NoteTypeRegistry<NoteTypeDetector> server-side where only id + detect are used.
 */
export interface NoteTypeDescriptor extends NoteTypeDetector {
  /** Which editor modes this note type supports. Defaults to all three. */
  supportedModes?: EditorMode[];
  /**
   * When true, the source pane shows raw text as read-only unless unlocked
   * (appropriate for canvas, table, board notes).
   */
  sourceProtected?: boolean;
  /** Whether split-mode scroll/cursor/focus synchronisation is meaningful. */
  supportsScrollSync?: boolean;
  /** React component that renders or edits this note type. */
  viewComponent?: NoteViewComponent;
  /** Toolbar items contributed by this note type. */
  toolbarItems?: NoteTypeToolbarItem[];
  /** Builds note-type-specific context menu items on right-click. */
  contextMenuBuilder?: NoteViewContextMenuBuilder;
}

// ── Accessor helpers ──────────────────────────────────────────────────────────

export function getNoteViewComponent(d: NoteTypeDescriptor): NoteViewComponent | undefined {
  return d.viewComponent;
}

export function getNoteViewToolbarItems(d: NoteTypeDescriptor): NoteTypeToolbarItem[] {
  return d.toolbarItems ?? [];
}

export function getNoteContextMenuBuilder(
  d: NoteTypeDescriptor,
): NoteViewContextMenuBuilder | undefined {
  return d.contextMenuBuilder;
}
