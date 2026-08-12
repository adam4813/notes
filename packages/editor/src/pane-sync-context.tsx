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
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useCursorSync, useFocusSync, useScrollSync } from "./use-pane-sync";
import type {
  CursorRequest,
  EditorMode,
  FocusRequest,
  MarkdownPane,
  MarkdownViewState,
  ScrollRequest,
} from "./types";

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
}

interface PaneSyncContextValue {
  source: SourcePaneState;
  rendered: RenderedPaneState;
  isStandalone: boolean;
}

const PaneSyncContext = createContext<PaneSyncContextValue | null>(null);

export function PaneSyncProvider({
  children,
  setMarkdownViewState,
  persistSession,
  mode,
  initialSession,
  splitScrollSync,
  isReadOnly,
  isStandalone,
}: {
  children: ReactNode;
  setMarkdownViewState: React.Dispatch<React.SetStateAction<MarkdownViewState>>;
  persistSession: (mode: EditorMode, state: MarkdownViewState) => void;
  mode: EditorMode;
  initialSession: {
    mode: EditorMode;
    viewState: MarkdownViewState;
  };
  splitScrollSync: boolean;
  isReadOnly: boolean;
  isStandalone: boolean;
}) {
  const { send: sendSourceCursor, request: requestSourceCursor } = useCursorSync(
    initialSession.viewState.sourceCursor,
  );
  const { send: sendRenderedCursor, request: requestRenderedCursor } = useCursorSync(
    initialSession.viewState.renderedCursor,
  );
  const { send: sendSourceScroll, request: requestSourceScroll } = useScrollSync(
    initialSession.viewState.sourceScrollRatio,
  );
  const { send: sendRenderedScroll, request: requestRenderedScroll } = useScrollSync(
    initialSession.viewState.renderedScrollRatio,
  );
  const { send: sendSourceFocus, request: requestSourceFocus } = useFocusSync();
  const { send: sendRenderedFocus, request: requestRenderedFocus } = useFocusSync();

  const activePaneRef = useRef<MarkdownPane>(initialSession.viewState.lastFocusedPane);
  const sourceCursorPosRef = useRef(initialSession.viewState.sourceCursor);
  const renderedCursorPosRef = useRef(initialSession.viewState.renderedCursor);
  const prevModeRef = useRef(mode);

  // Scroll-sync lock refs — prevent feedback loops when programmatically scrolling.
  const sourceScrollLock = useRef(false);
  const renderedScrollLock = useRef(false);

  const preferredPaneForMode = useCallback((nextMode: EditorMode): MarkdownPane => {
    if (nextMode === "edit") return "source";
    if (nextMode === "rendered") return "rendered";
    return activePaneRef.current;
  }, []);

  const requestPaneFocus = useCallback(
    (pane: MarkdownPane) => {
      if (pane === "source") sendSourceFocus();
      else sendRenderedFocus();
    },
    [sendSourceFocus, sendRenderedFocus],
  );

  useEffect(() => {
    const prev = prevModeRef.current;
    if (prev === mode) return;

    if (mode === "edit") {
      const position =
        activePaneRef.current === "rendered"
          ? renderedCursorPosRef.current
          : sourceCursorPosRef.current;
      sendSourceCursor(position);
      requestPaneFocus("source");
    } else if (mode === "rendered") {
      const position =
        activePaneRef.current === "source"
          ? sourceCursorPosRef.current
          : renderedCursorPosRef.current;
      sendRenderedCursor(position);
      requestPaneFocus("rendered");
    } else {
      requestPaneFocus(preferredPaneForMode(mode));
    }

    prevModeRef.current = mode;
  }, [mode, preferredPaneForMode, requestPaneFocus, sendSourceCursor, sendRenderedCursor]);

  const emitViewState = useCallback(
    (patch: Partial<MarkdownViewState>) => {
      setMarkdownViewState((prev) => {
        const next = { ...prev, ...patch };
        persistSession(mode, next);
        return next;
      });
    },
    [setMarkdownViewState, persistSession, mode],
  );

  const handleSourceFocus = useCallback(() => {
    activePaneRef.current = "source";
    emitViewState({ lastFocusedPane: "source" });
  }, [emitViewState]);

  const handleRenderedFocus = useCallback(() => {
    activePaneRef.current = "rendered";
    emitViewState({ lastFocusedPane: "rendered" });
  }, [emitViewState]);

  const handleSourceCursorChange = useCallback(
    (position: number) => {
      sourceCursorPosRef.current = position;
      emitViewState({ sourceCursor: position });
    },
    [emitViewState],
  );

  const handleRenderedCursorChange = useCallback(
    (position: number) => {
      renderedCursorPosRef.current = position;
      emitViewState({ renderedCursor: position });
    },
    [emitViewState],
  );

  const handleSourceScrollChange = useCallback(
    (ratio: number) => {
      emitViewState({ sourceScrollRatio: ratio });
      if (!splitScrollSync || mode !== "split") return;
      if (sourceScrollLock.current) {
        sourceScrollLock.current = false;
        return;
      }
      renderedScrollLock.current = true;
      sendRenderedScroll(ratio);
    },
    [emitViewState, mode, splitScrollSync, sendRenderedScroll],
  );

  const handleRenderedScrollChange = useCallback(
    (ratio: number) => {
      emitViewState({ renderedScrollRatio: ratio });
      if (!splitScrollSync || mode !== "split") return;
      if (renderedScrollLock.current) {
        renderedScrollLock.current = false;
        return;
      }
      sourceScrollLock.current = true;
      sendSourceScroll(ratio);
    },
    [emitViewState, mode, splitScrollSync, sendSourceScroll],
  );

  const value: PaneSyncContextValue = useMemo(
    () => ({
      source: {
        cursorRequest: requestSourceCursor,
        scrollRequest: requestSourceScroll,
        focusRequest: requestSourceFocus,
        onCursorChange: handleSourceCursorChange,
        onScrollChange: handleSourceScrollChange,
        onFocus: handleSourceFocus,
        isReadOnly,
      },
      rendered: {
        cursorRequest: requestRenderedCursor,
        scrollRequest: requestRenderedScroll,
        focusRequest: requestRenderedFocus,
        onCursorChange: handleRenderedCursorChange,
        onScrollChange: handleRenderedScrollChange,
        onFocus: handleRenderedFocus,
      },
      isStandalone,
    }),
    [
      handleRenderedCursorChange,
      handleRenderedFocus,
      handleRenderedScrollChange,
      handleSourceCursorChange,
      handleSourceFocus,
      handleSourceScrollChange,
      isReadOnly,
      isStandalone,
      requestRenderedCursor,
      requestRenderedFocus,
      requestRenderedScroll,
      requestSourceCursor,
      requestSourceFocus,
      requestSourceScroll,
    ],
  );
  return <PaneSyncContext.Provider value={value}>{children}</PaneSyncContext.Provider>;
}

/**
 * Returns the source-pane state from the nearest PaneSyncProvider.
 * Returns undefined when called outside a provider (standalone use).
 */
export function useSourcePaneSync():
  (SourcePaneState & Pick<PaneSyncContextValue, "isStandalone">) | undefined {
  const ctx = useContext(PaneSyncContext);
  if (!ctx) return undefined;
  return { ...ctx.source, isStandalone: ctx.isStandalone };
}

/**
 * Returns the rendered-pane state from the nearest PaneSyncProvider.
 * Returns undefined when called outside a provider (standalone use).
 */
export function useRenderedPaneSync():
  (RenderedPaneState & Pick<PaneSyncContextValue, "isStandalone">) | undefined {
  const ctx = useContext(PaneSyncContext);
  if (!ctx) return undefined;
  return { ...ctx.rendered, isStandalone: ctx.isStandalone };
}
