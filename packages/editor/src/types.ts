import type { ReactNode } from "react";

export type EditorMode = "edit" | "split" | "rendered";

export const EDITOR_MODES: EditorMode[] = ["edit", "split", "rendered"];

export interface WikiSuggestion {
  title: string;
  path: string;
}

/** MIME type used by the explorer when dragging notes. */
export const NOTES_PATH_MIME = "application/x-notes-path";

/** Returns the display title from a file path (basename without extension). */
export function noteNameFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.[^.]+$/, "");
}

/** Host-provided callbacks that connect the editor to the index/workspace. */
export interface EditorCallbacks {
  onOpenWikilink?: (name: string) => void;
  listNotes?: () => Promise<WikiSuggestion[]>;
  listTags?: () => Promise<string[]>;
  /** Renders an embedded note (`![[target]]`); when omitted, embeds are disabled. */
  renderEmbed?: (target: string) => ReactNode;
}
