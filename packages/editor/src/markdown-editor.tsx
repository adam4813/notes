/**
 * MarkdownEditor — a self-contained inline markdown component.
 *
 * This component is used as a lightweight inline editor wherever a markdown
 * snippet needs to be rendered or edited in place (e.g. board cards, calendar
 * event descriptions). It does NOT handle file I/O, registry routing, or the
 * full note-editor lifecycle — those concerns live in NoteEditor in apps/web.
 *
 * Props summary:
 *   - value / onChange  — the raw markdown string
 *   - mode              — "edit" | "split" | "rendered"
 *   - callbacks         — optional EditorCallbacks for wikilinks, embeds, etc.
 *   - viewState / onViewStateChange — cursor/scroll/focus persistence
 */
import type { NoteViewContextMenuBuilder } from "@notes/ui";
import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from "react";
import { RenderedEditor } from "./rendered-editor";
import { NativeSourceEditor } from "./native-source-editor";
import { EditorToolbar } from "./toolbar";
import {
  EDITOR_MODES,
  type CursorRequest,
  type EditorCallbacks,
  type EditorMode,
  type FocusRequest,
  type ScrollRequest,
} from "./types";
import { useCursorSync, useFocusSync, useScrollSync } from "./use-pane-sync";

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

interface MarkdownEditorProps {
  mode: EditorMode;
  path?: string;
  value: string;
  onChange: (markdown: string) => void;
  disableToolbarInEdit?: boolean;
  viewState?: MarkdownViewState;
  onViewStateChange?: (patch: Partial<MarkdownViewState>) => void;
  syncSplitScroll?: boolean;
  isStandalone?: boolean;
  isReadOnly?: boolean;
  callbacks?: EditorCallbacks;
  setNoteViewCtxBuilder?: Dispatch<SetStateAction<NoteViewContextMenuBuilder | null>>;
}

export interface RendererProps {
  path: string;
  value: string;
  onChange: (markdown: string) => void;
  callbacks?: EditorCallbacks;
  isStandalone?: boolean;
  cursorRequest?: CursorRequest;
  scrollRequest?: ScrollRequest;
  onCursorChange?: (position: number) => void;
  onScrollChange?: (ratio: number) => void;
  onFocus?: () => void;
  focusRequest?: FocusRequest;
  onRegisterContextMenu?: Dispatch<SetStateAction<NoteViewContextMenuBuilder | null>>;
}

/**
 * Lightweight inline markdown editor. Use for embedding a markdown view
 * inside other components (board cards, modals, etc.).
 *
 * For the full note-editor experience with file I/O, registry routing, and
 * save state, use `NoteEditor` in apps/web instead.
 */
export function MarkdownEditor({
  mode,
  value,
  onChange,
  disableToolbarInEdit = false,
  viewState,
  onViewStateChange,
  syncSplitScroll = true,
  isStandalone = false,
  isReadOnly = false,
  callbacks,
}: MarkdownEditorProps) {
  const sourceCursor = useCursorSync(
    viewState?.sourceCursor ?? DEFAULT_MARKDOWN_VIEW_STATE.sourceCursor,
  );
  const renderedCursor = useCursorSync(
    viewState?.renderedCursor ?? DEFAULT_MARKDOWN_VIEW_STATE.renderedCursor,
  );
  const sourceScroll = useScrollSync(
    viewState?.sourceScrollRatio ?? DEFAULT_MARKDOWN_VIEW_STATE.sourceScrollRatio,
  );
  const renderedScroll = useScrollSync(
    viewState?.renderedScrollRatio ?? DEFAULT_MARKDOWN_VIEW_STATE.renderedScrollRatio,
  );
  const sourceFocus = useFocusSync();
  const renderedFocus = useFocusSync();

  const activePaneRef = useRef<MarkdownPane>(
    viewState?.lastFocusedPane ?? DEFAULT_MARKDOWN_VIEW_STATE.lastFocusedPane,
  );
  const sourceCursorPosRef = useRef(
    viewState?.sourceCursor ?? DEFAULT_MARKDOWN_VIEW_STATE.sourceCursor,
  );
  const renderedCursorPosRef = useRef(
    viewState?.renderedCursor ?? DEFAULT_MARKDOWN_VIEW_STATE.renderedCursor,
  );
  const prevModeRef = useRef(mode);
  // Scroll-sync lock refs — prevent feedback loops when programmatically scrolling.
  const sourceScrollLock = useRef(false);
  const renderedScrollLock = useRef(false);

  const emitViewState = useCallback(
    (patch: Partial<MarkdownViewState>) => onViewStateChange?.(patch),
    [onViewStateChange],
  );

  const preferredPaneForMode = useCallback((nextMode: EditorMode): MarkdownPane => {
    if (nextMode === "edit") return "source";
    if (nextMode === "rendered") return "rendered";
    return activePaneRef.current;
  }, []);

  const requestPaneFocus = useCallback(
    (pane: MarkdownPane) => {
      if (pane === "source") sourceFocus.send();
      else renderedFocus.send();
    },
    [sourceFocus, renderedFocus],
  );

  useEffect(() => {
    requestPaneFocus(preferredPaneForMode(mode));
  }, [mode, preferredPaneForMode, requestPaneFocus]);

  useEffect(() => {
    const prev = prevModeRef.current;
    if (prev === mode) return;

    if (mode === "edit") {
      const position =
        activePaneRef.current === "rendered"
          ? renderedCursorPosRef.current
          : sourceCursorPosRef.current;
      sourceCursor.send(position);
      requestPaneFocus("source");
    } else if (mode === "rendered") {
      const position =
        activePaneRef.current === "source"
          ? sourceCursorPosRef.current
          : renderedCursorPosRef.current;
      renderedCursor.send(position);
      requestPaneFocus("rendered");
    } else {
      requestPaneFocus(preferredPaneForMode(mode));
    }

    prevModeRef.current = mode;
  }, [mode, preferredPaneForMode, requestPaneFocus, sourceCursor, renderedCursor]);

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
      if (!syncSplitScroll || mode !== "split") return;
      if (sourceScrollLock.current) {
        sourceScrollLock.current = false;
        return;
      }
      renderedScrollLock.current = true;
      renderedScroll.send(ratio);
    },
    [emitViewState, mode, syncSplitScroll, renderedScroll],
  );

  const handleRenderedScrollChange = useCallback(
    (ratio: number) => {
      emitViewState({ renderedScrollRatio: ratio });
      if (!syncSplitScroll || mode !== "split") return;
      if (renderedScrollLock.current) {
        renderedScrollLock.current = false;
        return;
      }
      sourceScrollLock.current = true;
      sourceScroll.send(ratio);
    },
    [emitViewState, mode, syncSplitScroll, sourceScroll],
  );

  const supportedModes = EDITOR_MODES;
  const effectiveMode = supportedModes.includes(mode) ? mode : (supportedModes[0] ?? "rendered");
  const showSource = effectiveMode === "edit" || effectiveMode === "split";
  const showRendered = effectiveMode === "rendered" || effectiveMode === "split";

  return (
    <div className={`markdown-editor-shell markdown-editor-shell--${effectiveMode}`}>
      {effectiveMode === "edit" && disableToolbarInEdit && <EditorToolbar editor={null} disabled />}
      <div className={`markdown-editor markdown-editor--${effectiveMode}`}>
        {showSource && (
          <div className="editor-column editor-column--split">
            <NativeSourceEditor
              value={value}
              onChange={isReadOnly ? () => {} : onChange}
              callbacks={callbacks}
              focusRequest={sourceFocus.request}
              onFocus={handleSourceFocus}
              scrollRequest={sourceScroll.request}
              onScrollChange={handleSourceScrollChange}
              cursorRequest={sourceCursor.request}
              onCursorChange={handleSourceCursorChange}
            />
          </div>
        )}
        {showRendered && (
          <RenderedEditor
            value={value}
            onChange={onChange}
            callbacks={callbacks}
            isStandalone={isStandalone}
            cursorRequest={renderedCursor.request}
            scrollRequest={renderedScroll.request}
            onFocus={handleRenderedFocus}
            onCursorChange={handleRenderedCursorChange}
            onScrollChange={handleRenderedScrollChange}
            focusRequest={renderedFocus.request}
          />
        )}
      </div>
    </div>
  );
}
