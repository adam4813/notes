import { MARKDOWN_NOTE_TYPE_ID } from "@notes/core";
import { BOARD_NOTE_TYPE_ID, BoardView } from "@notes/note-boards";
import { CALENDAR_NOTE_TYPE_ID, CalendarView } from "@notes/note-calendar";
import { CANVAS_NOTE_TYPE_ID, CanvasView } from "@notes/note-canvas";
import { GRID_NOTE_TYPE_ID, GridView } from "@notes/note-grid";
import { MERMAID_NOTE_TYPE_ID, MermaidView } from "@notes/note-mermaid";
import { TABLE_NOTE_TYPE_ID, TableGrid } from "@notes/note-tables";
import type { NoteViewContextMenuBuilder } from "@notes/ui";
import { api } from "@notes/web/src/api/client";
import { EmbedWidget } from "@notes/web/src/components/embed-widget";
import { frontmatterType } from "@notes/web/src/lib/frontmatter";
import {
  importedFilePath,
  markdownForImportedFile,
  normalizeMediaDirectory,
  toBase64,
} from "@notes/web/src/lib/images";
import { useWorkspace } from "@notes/web/src/state/app-context";
import { useAppServices } from "@notes/web/src/state/app-services";
import { useToasts } from "@notes/web/src/state/toast";
import {
  ComponentType,
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RenderedEditor } from "./rendered-editor";
import { NativeSourceEditor } from "./native-source-editor";
import { EditorToolbar } from "./toolbar";
import type {
  CursorRequest,
  EditorCallbacks,
  EditorMode,
  FocusRequest,
  ScrollRequest,
} from "./types";

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
  /** When true, disables all file/note drop-and-paste operations. */
  isStandalone?: boolean;
  isReadOnly?: boolean;
  setNoteViewCtxBuilder?: Dispatch<SetStateAction<NoteViewContextMenuBuilder | null>>;
}

interface RendererProps {
  path: string;
  value: string;
  onChange: (markdown: string) => void;
  callbacks?: EditorCallbacks;
  isStandalone?: boolean; // If the file belongs to the tome or not
  cursorRequest?: CursorRequest;
  scrollRequest?: ScrollRequest;
  onCursorChange?: (position: number) => void;
  onScrollChange?: (ratio: number) => void;
  onFocus?: () => void;
  focusRequest?: FocusRequest;
  onRegisterContextMenu?: Dispatch<SetStateAction<NoteViewContextMenuBuilder | null>>;
}

const NOTE_RENDERERS: Record<string, ComponentType<RendererProps>> = {
  [MARKDOWN_NOTE_TYPE_ID]: RenderedEditor,
  [CANVAS_NOTE_TYPE_ID]: CanvasView,
  [BOARD_NOTE_TYPE_ID]: BoardView,
  [TABLE_NOTE_TYPE_ID]: TableGrid,
  [MERMAID_NOTE_TYPE_ID]: MermaidView,
  [CALENDAR_NOTE_TYPE_ID]: CalendarView,
  [GRID_NOTE_TYPE_ID]: GridView,
};

function basename(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
}

/**
 * Hybrid markdown editor. A single `value` (markdown) drives both a source view and a TipTap
 * rendered view; in split mode both are shown and stay in sync through the shared value.
 */
export function MarkdownEditor({
  mode,
  path,
  value,
  onChange,
  disableToolbarInEdit = false,
  viewState,
  onViewStateChange,
  syncSplitScroll = true,
  isStandalone = false,
  isReadOnly,
  setNoteViewCtxBuilder,
}: MarkdownEditorProps) {
  const { dispatch } = useWorkspace();
  const { settings } = useAppServices();
  const { notify } = useToasts();

  const sourceCursorRef = useRef(
    viewState?.sourceCursor ?? DEFAULT_MARKDOWN_VIEW_STATE.sourceCursor,
  );
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

  const requestPaneFocus = useCallback((pane: MarkdownPane) => {
    if (pane === "source") {
      setSourceFocusRequest({ token: nextToken() });
    } else {
      setRenderedFocusRequest({ token: nextToken() });
    }
  }, []);

  const preferredPaneForMode = useCallback((nextMode: EditorMode): MarkdownPane => {
    if (nextMode === "edit") {
      return "source";
    }
    if (nextMode === "rendered") {
      return "rendered";
    }
    return activePaneRef.current;
  }, []);

  useEffect(() => {
    requestPaneFocus(preferredPaneForMode(mode));
  }, [mode, preferredPaneForMode, requestPaneFocus]);

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

  const callbacks = useMemo<EditorCallbacks>(
    () => ({
      onOpenWikilink: (name) => {
        void (async () => {
          const resolved = await api.resolve(name);
          if (resolved.path) {
            dispatch({ type: "openFile", path: resolved.path, title: name });
            return;
          }
          const newPath = `${name}.md`;
          await api.create(newPath, `# ${name}\n\n`).catch(() => undefined);
          dispatch({ type: "openFile", path: newPath, title: name });
        })();
      },
      onOpenFile: (path) => dispatch({ type: "openFile", path: path, title: basename(path) }),
      listNotes: async () => (await api.notes()).notes,
      listTags: async () => (await api.tags()).tags.map((tag) => tag.tag),
      onImportFile: isStandalone
        ? undefined
        : async (file) => {
            const mediaPath = importedFilePath(
              file,
              normalizeMediaDirectory(settings.mediaDirectory),
            );
            try {
              const bytes = new Uint8Array(await file.arrayBuffer());
              await api.createBinary(mediaPath, toBase64(bytes));
              notify(`Imported file saved to ${mediaPath}`, { kind: "success" });
              return markdownForImportedFile(mediaPath, file.type, api.fileRawUrl(mediaPath));
            } catch {
              notify("Couldn't import dropped file", { kind: "error" });
              return null;
            }
          },
      renderEmbed: (embedTarget) => <EmbedWidget target={embedTarget} />,
      disableFileDrop: isStandalone,
    }),
    [dispatch, notify, settings.mediaDirectory, isStandalone],
  );
  const isCanvas = path?.toLowerCase().endsWith(".canvas");
  const frontType = isCanvas
    ? CANVAS_NOTE_TYPE_ID
    : (frontmatterType(value) ?? MARKDOWN_NOTE_TYPE_ID);
  const NoteRenderer = NOTE_RENDERERS[frontType];

  return (
    <div className={`markdown-editor-shell markdown-editor-shell--${mode}`}>
      {mode === "edit" && disableToolbarInEdit && <EditorToolbar editor={null} disabled />}
      <div className={`markdown-editor markdown-editor--${mode}`}>
        {showSource && (
          <div className="editor-column editor-column--split">
            <NativeSourceEditor
              value={value}
              onChange={isReadOnly ? () => {} : onChange}
              callbacks={callbacks}
              focusRequest={sourceFocusRequest}
              onFocus={handleSourceFocus}
              scrollRequest={sourceScrollRequest}
              onScrollChange={handleSourceScrollChange}
              cursorRequest={sourceCursorRequest}
              onCursorChange={handleSourceCursorChange}
            />
          </div>
        )}
        {showRendered && (
          <NoteRenderer
            path={path ?? ""}
            value={value}
            onChange={onChange}
            callbacks={callbacks}
            isStandalone={isStandalone}
            cursorRequest={renderedCursorRequest}
            scrollRequest={renderedScrollRequest}
            onFocus={handleRenderedFocus}
            onCursorChange={handleRenderedCursorChange}
            onScrollChange={handleRenderedScrollChange}
            focusRequest={renderedFocusRequest}
            onRegisterContextMenu={setNoteViewCtxBuilder}
          />
        )}
      </div>
    </div>
  );
}
