import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { EditorToolbar } from "./toolbar";
import { RenderedEditor } from "./rendered-editor";
import { SourceEditor } from "./source-editor";
import type { CursorRequest, EditorCallbacks, EditorMode, FocusRequest, ScrollRequest } from "./types";

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
  value: string;
  mode: EditorMode;
  onChange: (markdown: string) => void;
  callbacks?: EditorCallbacks;
  toolbarTrailing?: ReactNode;
  disableToolbarInEdit?: boolean;
  viewState?: MarkdownViewState;
  onViewStateChange?: (patch: Partial<MarkdownViewState>) => void;
  syncSplitScroll?: boolean;
}

/**
 * Hybrid markdown editor. A single `value` (markdown) drives both a CodeMirror
 * source view and a TipTap rendered view; in split mode both are shown and stay
 * in sync through the shared value.
 */
export function MarkdownEditor({
  value,
  mode,
  onChange,
  callbacks,
  toolbarTrailing,
  disableToolbarInEdit = false,
  viewState,
  onViewStateChange,
  syncSplitScroll = true,
}: MarkdownEditorProps) {
  const sourceCursorRef = useRef(viewState?.sourceCursor ?? DEFAULT_MARKDOWN_VIEW_STATE.sourceCursor);
  const renderedCursorRef = useRef(
    viewState?.renderedCursor ?? DEFAULT_MARKDOWN_VIEW_STATE.renderedCursor,
  );
  const activePaneRef = useRef<MarkdownPane>(
    viewState?.lastFocusedPane ?? DEFAULT_MARKDOWN_VIEW_STATE.lastFocusedPane,
  );
  const tokenRef = useRef(3);
  const syncLockRef = useRef<MarkdownPane | null>(null);
  const prevModeRef = useRef(mode);

  const [sourceCursorRequest, setSourceCursorRequest] = useState<CursorRequest>({
    token: 1,
    position: viewState?.sourceCursor ?? DEFAULT_MARKDOWN_VIEW_STATE.sourceCursor,
  });
  const [renderedCursorRequest, setRenderedCursorRequest] = useState<CursorRequest>({
    token: 1,
    position: viewState?.renderedCursor ?? DEFAULT_MARKDOWN_VIEW_STATE.renderedCursor,
  });
  const [sourceScrollRequest, setSourceScrollRequest] = useState<ScrollRequest>({
    token: 1,
    ratio: viewState?.sourceScrollRatio ?? DEFAULT_MARKDOWN_VIEW_STATE.sourceScrollRatio,
  });
  const [renderedScrollRequest, setRenderedScrollRequest] = useState<ScrollRequest>({
    token: 1,
    ratio: viewState?.renderedScrollRatio ?? DEFAULT_MARKDOWN_VIEW_STATE.renderedScrollRatio,
  });
  const [sourceFocusRequest, setSourceFocusRequest] = useState<FocusRequest>({ token: 1 });
  const [renderedFocusRequest, setRenderedFocusRequest] = useState<FocusRequest>({ token: 1 });

  const nextToken = () => {
    const token = tokenRef.current;
    tokenRef.current += 1;
    return token;
  };

  const emitViewState = useCallback(
    (patch: Partial<MarkdownViewState>) => {
      onViewStateChange?.(patch);
    },
    [onViewStateChange],
  );

  const requestPaneFocus = useCallback(
    (pane: MarkdownPane) => {
      if (pane === "source") {
        setSourceFocusRequest({ token: nextToken() });
      } else {
        setRenderedFocusRequest({ token: nextToken() });
      }
    },
    [setSourceFocusRequest, setRenderedFocusRequest],
  );

  const preferredPaneForMode = useCallback(
    (nextMode: EditorMode): MarkdownPane => {
      if (nextMode === "edit") {
        return "source";
      }
      if (nextMode === "rendered") {
        return "rendered";
      }
      return activePaneRef.current;
    },
    [],
  );

  useEffect(() => {
    requestPaneFocus(preferredPaneForMode(mode));
  }, []);

  useEffect(() => {
    const prev = prevModeRef.current;
    if (prev === mode) {
      return;
    }

    if (mode === "edit") {
      const position =
        activePaneRef.current === "rendered" ? renderedCursorRef.current : sourceCursorRef.current;
      setSourceCursorRequest({ token: nextToken(), position });
      requestPaneFocus("source");
    } else if (mode === "rendered") {
      const position =
        activePaneRef.current === "source" ? sourceCursorRef.current : renderedCursorRef.current;
      setRenderedCursorRequest({ token: nextToken(), position });
      requestPaneFocus("rendered");
    } else {
      requestPaneFocus(preferredPaneForMode(mode));
    }

    prevModeRef.current = mode;
  }, [mode, preferredPaneForMode, requestPaneFocus]);

  const showSource = mode === "edit" || mode === "split";
  const showRendered = mode === "rendered" || mode === "split";

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
      sourceCursorRef.current = position;
      emitViewState({ sourceCursor: position });
    },
    [emitViewState],
  );

  const handleRenderedCursorChange = useCallback(
    (position: number) => {
      renderedCursorRef.current = position;
      emitViewState({ renderedCursor: position });
    },
    [emitViewState],
  );

  const handleSourceScrollChange = useCallback(
    (ratio: number) => {
      emitViewState({ sourceScrollRatio: ratio });
      if (!syncSplitScroll || mode !== "split") {
        return;
      }
      if (syncLockRef.current === "source") {
        syncLockRef.current = null;
        return;
      }
      syncLockRef.current = "rendered";
      setRenderedScrollRequest({ token: nextToken(), ratio });
    },
    [emitViewState, mode, syncSplitScroll],
  );

  const handleRenderedScrollChange = useCallback(
    (ratio: number) => {
      emitViewState({ renderedScrollRatio: ratio });
      if (!syncSplitScroll || mode !== "split") {
        return;
      }
      if (syncLockRef.current === "rendered") {
        syncLockRef.current = null;
        return;
      }
      syncLockRef.current = "source";
      setSourceScrollRequest({ token: nextToken(), ratio });
    },
    [emitViewState, mode, syncSplitScroll],
  );

  return (
    <div className={`markdown-editor-shell markdown-editor-shell--${mode}`}>
      {mode === "edit" && disableToolbarInEdit && (
        <EditorToolbar editor={null} disabled trailing={toolbarTrailing} />
      )}
      <div className={`markdown-editor markdown-editor--${mode}`}>
        {showSource && (
          <div className="editor-column editor-column--source">
            <SourceEditor
              value={value}
              onChange={onChange}
              callbacks={callbacks}
              cursorRequest={sourceCursorRequest}
              scrollRequest={sourceScrollRequest}
              onFocus={handleSourceFocus}
              onCursorChange={handleSourceCursorChange}
              onScrollChange={handleSourceScrollChange}
              focusRequest={sourceFocusRequest}
            />
          </div>
        )}
        {showRendered && (
          <div className="editor-column editor-column--rendered">
            <RenderedEditor
              value={value}
              onChange={onChange}
              callbacks={callbacks}
              toolbarTrailing={toolbarTrailing}
              cursorRequest={renderedCursorRequest}
              scrollRequest={renderedScrollRequest}
              onFocus={handleRenderedFocus}
              onCursorChange={handleRenderedCursorChange}
              onScrollChange={handleRenderedScrollChange}
              focusRequest={renderedFocusRequest}
            />
          </div>
        )}
      </div>
    </div>
  );
}
