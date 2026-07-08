import type { ReactNode } from "react";

export type EditorMode = "edit" | "split" | "rendered";

export const EDITOR_MODES: EditorMode[] = ["edit", "split", "rendered"];

export interface WikiSuggestion {
  title: string;
  path: string;
}

/** Host-provided callbacks that connect the editor to the index/workspace. */
export interface EditorCallbacks {
  onOpenWikilink?: (name: string) => void;
  listNotes?: () => Promise<WikiSuggestion[]>;
  listTags?: () => Promise<string[]>;
  /** Renders an embedded note (`![[target]]`); when omitted, embeds are disabled. */
  renderEmbed?: (target: string) => ReactNode;
}
