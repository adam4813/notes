import type { ReactNode } from "react";

/** The three editor modes available for a note-type view. */
export type EditorMode = "edit" | "split" | "rendered";

export const EDITOR_MODES: EditorMode[] = ["edit", "split", "rendered"];

// ── Markdown view state ───────────────────────────────────────────────────────

export type MarkdownPane = "source" | "rendered";

export interface MarkdownViewState {
  sourceCursor: number;
  renderedCursor: number;
  sourceScrollRatio: number;
  renderedScrollRatio: number;
  lastFocusedPane: MarkdownPane;
  splitScrollSync: boolean;
}

export const DEFAULT_MARKDOWN_VIEW_STATE: MarkdownViewState = {
  sourceCursor: 0,
  renderedCursor: 1,
  sourceScrollRatio: 0,
  renderedScrollRatio: 0,
  lastFocusedPane: "rendered",
  splitScrollSync: true,
};

export interface WikiSuggestion {
  title: string;
  path: string;
}

export interface CursorRequest {
  token: number;
  position: number;
}

export interface ScrollRequest {
  token: number;
  ratio: number;
}

export interface FocusRequest {
  token: number;
}

/** MIME type used by the explorer when dragging notes. */
export const NOTES_PATH_MIME = "application/x-notes-path";

/** Returns the display title from a file path (basename without extension). */
export function noteNameFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.[^.]+$/, "");
}

/**
 * Returns the internal wikilink target for a dragged file path.
 * Notes keep extensionless targets; binary/media files keep their extension.
 */
export function wikilinkTargetFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".canvas")) {
    return path.replace(/\.[^.]+$/, "");
  }
  return path;
}

function isImageFilePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(path);
}

function rawFileUrl(path: string): string {
  return `/api/file/raw?path=${encodeURIComponent(path)}`;
}

/**
 * Returns insertion text for an internal explorer drop.
 * Alt/Option currently requests a plain wikilink.
 */
export function droppedPathInsertion(path: string, plainLink: boolean): string {
  const target = wikilinkTargetFromPath(path);
  if (plainLink) {
    return `[[${target}]]`;
  }
  if (isImageFilePath(path)) {
    const alt = path.split("/").pop() ?? "image";
    return `<img src="${rawFileUrl(path)}" alt="${alt}">`;
  }
  return `![[${target}]]`;
}

/** Host-provided callbacks that connect the editor to the index/workspace. */
export interface EditorCallbacks {
  onOpenWikilink?: (name: string) => void;
  onOpenFile?: (path: string) => void;
  listNotes?: () => Promise<WikiSuggestion[]>;
  listTags?: () => Promise<string[]>;
  /** Imports a pasted/dropped file and returns markdown/html to insert at the caret. */
  onImportFile?: (file: File) => Promise<string | null>;
  /** Renders an embedded note (`![[target]]`); when omitted, embeds are disabled. */
  renderEmbed?: (target: string) => ReactNode;
  /**
   * When true, all file/note drops and file pastes are disabled.
   * Use for standalone files that should not import local assets.
   */
  disableFileDrop?: boolean;
}

// ── Renderer contract ─────────────────────────────────────────────────────────

/**
 * Props for registry-registered note renderers (canvas, board, table, markdown, …).
 *
 * Cursor/scroll/focus sync is no longer in RendererProps — renderers that need it
 * consume PaneSyncContext directly via the hooks in pane-sync-context.tsx.
 */
export interface RendererProps {
  path: string;
  value: string;
  onChange: (markdown: string) => void;
  callbacks?: EditorCallbacks;
  isStandalone?: boolean;
  /**
   * Called by the renderer to register a note-specific context-menu builder.
   * Pass null (or call with null at cleanup) to unregister.
   * Typed as unknown[] to avoid importing @notes/ui here; consumers cast to ContextMenuEntry[].
   */
  onRegisterContextMenu?: (builder: ((target: Element | null) => unknown[] | null) | null) => void;
}
