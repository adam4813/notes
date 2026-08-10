/**
 * PaneSyncContext — shared state for the split-editor pane pair.
 *
 * NoteEditor provides this context; NativeSourceEditor and RenderedEditor
 * consume it via the hooks below instead of receiving props. Renderers that
 * do not need sync (canvas, board, table) can ignore it entirely.
 *
 * The context is nullable — hooks return undefined when called outside a
 * PaneSyncProvider, which lets RenderedEditor work standalone (board cards,
 * calendar modals) without sync or callbacks.
 */
import { createContext, type ReactNode, useContext } from "react";
import type { CursorRequest, EditorCallbacks, FocusRequest, ScrollRequest } from "./types";

/** State exposed to the source (raw-text) pane. */
export interface SourcePaneState {
  cursorRequest: CursorRequest;
  scrollRequest: ScrollRequest | undefined;
  focusRequest: FocusRequest;
  onCursorChange: (position: number) => void;
  onScrollChange: ((ratio: number) => void) | undefined;
  onFocus: () => void;
  /** When true, the source pane should be read-only. */
  isReadOnly: boolean;
}

/** State exposed to the rendered (WYSIWYG) pane. */
export interface RenderedPaneState {
  cursorRequest: CursorRequest;
  scrollRequest: ScrollRequest | undefined;
  focusRequest: FocusRequest;
  onCursorChange: (position: number) => void;
  onScrollChange: ((ratio: number) => void) | undefined;
  onFocus: () => void;
  /**
   * Called by the rendered pane to register / unregister a note-type-specific
   * context-menu builder. Pass null to unregister.
   */
  onRegisterContextMenu: (builder: ((target: Element | null) => unknown[] | null) | null) => void;
}

export interface PaneSyncContextValue {
  source: SourcePaneState;
  rendered: RenderedPaneState;
  callbacks: EditorCallbacks;
  isStandalone: boolean;
}

const PaneSyncContext = createContext<PaneSyncContextValue | null>(null);

export function PaneSyncProvider({
  value,
  children,
}: {
  value: PaneSyncContextValue;
  children: ReactNode;
}) {
  return <PaneSyncContext.Provider value={value}>{children}</PaneSyncContext.Provider>;
}

/**
 * Returns the source-pane state from the nearest PaneSyncProvider.
 * Returns undefined when called outside a provider (standalone use).
 */
export function useSourcePaneSync():
  (SourcePaneState & Pick<PaneSyncContextValue, "callbacks" | "isStandalone">) | undefined {
  const ctx = useContext(PaneSyncContext);
  if (!ctx) return undefined;
  return { ...ctx.source, callbacks: ctx.callbacks, isStandalone: ctx.isStandalone };
}

/**
 * Returns the rendered-pane state from the nearest PaneSyncProvider.
 * Returns undefined when called outside a provider (standalone use).
 */
export function useRenderedPaneSync():
  (RenderedPaneState & Pick<PaneSyncContextValue, "callbacks" | "isStandalone">) | undefined {
  const ctx = useContext(PaneSyncContext);
  if (!ctx) return undefined;
  return { ...ctx.rendered, callbacks: ctx.callbacks, isStandalone: ctx.isStandalone };
}
