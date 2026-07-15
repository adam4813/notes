import {
  DEFAULT_MARKDOWN_VIEW_STATE,
  MarkdownEditor,
  type MarkdownViewState,
  NoteToolbar,
  EDITOR_MODES,
  type EditorCallbacks,
  type EditorMode,
} from "@notes/editor";
import { CanvasView } from "@notes/note-canvas";
import { BoardView } from "@notes/note-boards";
import { CalendarView } from "@notes/note-calendar";
import { GridView } from "@notes/note-grid";
import { MermaidView } from "@notes/note-mermaid";
import { TableGrid } from "@notes/note-tables";
import { ContextMenu, ContextMenuEntry, useContextMenu } from "@notes/ui";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { api } from "../api/client";
import { queueWrite } from "../api/offline-queue";
import { connectTomeChanges } from "../api/ws";
import {
  importedFilePath,
  isImagePath,
  markdownForImportedFile,
  normalizeMediaDirectory,
  toBase64,
} from "../lib/images";
import { useAppServices } from "../state/app-services";
import { useWorkspace } from "../state/app-context";
import { useToasts } from "../state/toast";
import { EmbedWidget } from "./embed-widget";
import { FindBar } from "./find-bar";
import { buildContent, parseFrontmatter } from "../lib/frontmatter";

function basename(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
}

function getFrontmatterType(content: string): string | undefined {
  const block = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!block) {
    return undefined;
  }
  return /^type:\s*(.+)$/m.exec(block[1])?.[1].trim();
}

type SaveState = "loading" | "saved" | "saving" | "unsaved" | "error" | "external" | "offline";
type RenderedWidthMode = "normal" | "wide";
type RenderedWidthOverride = RenderedWidthMode | "unset";

const RENDERED_WIDTH_FRONTMATTER_KEY = "__notes_rendered_width";

const MODE_LABEL: Record<EditorMode, string> = {
  edit: "Edit",
  split: "Split",
  rendered: "Rendered",
};

const SAVE_LABEL: Record<SaveState, string> = {
  loading: "Loading…",
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved…",
  error: "Save failed",
  external: "Changed on disk",
  offline: "Saved offline",
};

function parseRenderedWidthMode(value: string | null | undefined): RenderedWidthMode | undefined {
  return value === "normal" || value === "wide" ? value : undefined;
}

function readRenderedWidthOverride(content: string): RenderedWidthMode | undefined {
  const parsed = parseFrontmatter(content);
  const raw = parsed.props.find((prop) => prop.key === RENDERED_WIDTH_FRONTMATTER_KEY)?.value;
  return parseRenderedWidthMode(raw);
}

function applyRenderedWidthOverride(content: string, override: RenderedWidthOverride): string {
  const parsed = parseFrontmatter(content);
  const props = parsed.props.filter((prop) => prop.key !== RENDERED_WIDTH_FRONTMATTER_KEY);
  if (override === "normal" || override === "wide") {
    props.push({ key: RENDERED_WIDTH_FRONTMATTER_KEY, value: override });
  }
  return buildContent(props, parsed.body);
}

interface PersistedEditorSession {
  mode: EditorMode;
  viewState: MarkdownViewState;
}

const markdownSessionByPath = new Map<string, PersistedEditorSession>();

function editorStateKey(path: string): string {
  return path.replaceAll("\\", "/").toLowerCase();
}

export function NoteEditor({
  path,
  defaultMode = "rendered",
  disableModeToggle,
}: {
  path: string;
  defaultMode?: EditorMode;
  disableModeToggle?: boolean;
}) {
  const { dispatch } = useWorkspace();
  const { markModified, setActiveDocument, settings } = useAppServices();
  const { notify } = useToasts();
  const stateKey = editorStateKey(path);
  const initialSession = markdownSessionByPath.get(stateKey) ?? {
    mode: defaultMode,
    viewState: { ...DEFAULT_MARKDOWN_VIEW_STATE },
  };
  const markdownViewStateRef = useRef<MarkdownViewState>(initialSession.viewState);
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<EditorMode>(initialSession.mode);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [findOpen, setFindOpen] = useState(false);
  const [splitScrollSync, setSplitScrollSync] = useState(initialSession.viewState.splitScrollSync);
  const ctxMenu = useContextMenu<HTMLElement | null>();
  const regionRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const contentRef = useRef("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastWriteAtRef = useRef(0);
  // Always-current ref so the unmount cleanup can flush the right path/content.
  const pathRef = useRef(path);
  pathRef.current = path;
  const isImage = isImagePath(path);

  const persistSession = useCallback(
    (nextMode: EditorMode, nextViewState: MarkdownViewState) => {
      markdownSessionByPath.set(stateKey, { mode: nextMode, viewState: nextViewState });
    },
    [stateKey],
  );

  useEffect(() => {
    persistSession(mode, markdownViewStateRef.current);
  }, [mode, persistSession]);

  // Flush any unsaved edit when the component unmounts (tab switch / close).
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      if (!isImage && dirtyRef.current) {
        void api.write(pathRef.current, contentRef.current).catch(() => undefined);
      }
    };
  }, [isImage]); // empty deps: runs only on unmount

  useEffect(() => {
    let cancelled = false;
    setSaveState("loading");
    if (isImage) {
      setContent("");
      contentRef.current = "";
      dirtyRef.current = false;
      setSaveState("saved");
      return () => {
        cancelled = true;
      };
    }
    api
      .read(path)
      .then((result) => {
        if (!cancelled) {
          setContent(result.content);
          contentRef.current = result.content;
          dirtyRef.current = false;
          setSaveState("saved");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSaveState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, isImage]);

  const save = useCallback(
    async (value: string) => {
      setSaveState("saving");
      try {
        await api.write(path, value);
        lastWriteAtRef.current = Date.now();
        dirtyRef.current = false;
        setSaveState("saved");
      } catch {
        // Never lose the edit: buffer it locally to sync when back online.
        queueWrite({ path, content: value });
        dirtyRef.current = false;
        setSaveState("offline");
        notify("Offline — your changes are saved locally and will sync automatically.", {
          kind: "info",
        });
      }
    },
    [path, notify],
  );

  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      contentRef.current = value;
      dirtyRef.current = true;
      setSaveState("unsaved");
      markModified(path);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      saveTimer.current = setTimeout(() => void save(value), 600);
    },
    [save, markModified, path],
  );

  // Reload on external changes when there are no unsaved local edits.
  useEffect(() => {
    return connectTomeChanges((change) => {
      if (change.path !== path) {
        return;
      }
      if (isImage) {
        return;
      }
      // Ignore the file-watcher echo of our own atomic write, which would
      // otherwise reload and reset the cursor while the user keeps editing.
      if (Date.now() - lastWriteAtRef.current < 1500) {
        return;
      }
      if (dirtyRef.current) {
        setSaveState("external");
        return;
      }
      void api.read(path).then((result) => {
        if (result.content !== contentRef.current) {
          setContent(result.content);
          contentRef.current = result.content;
        }
      });
    });
  }, [path, isImage]);

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
      listNotes: async () => (await api.notes()).notes,
      listTags: async () => (await api.tags()).tags.map((tag) => tag.tag),
      onImportFile: async (file) => {
        const mediaPath = importedFilePath(file, normalizeMediaDirectory(settings.mediaDirectory));
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
    }),
    [dispatch, notify, settings.mediaDirectory],
  );

  const subscribeToFileChange = useCallback(
    (filePath: string, cb: () => void) =>
      connectTomeChanges((change) => {
        if (change.path === filePath) cb();
      }),
    [],
  );

  // Publish the active document to plugins (word count, etc.).
  useEffect(() => {
    if (saveState === "loading") {
      return;
    }
    const type = isImage
      ? "image"
      : path.toLowerCase().endsWith(".canvas")
        ? "canvas"
        : (getFrontmatterType(content) ?? "markdown");
    setActiveDocument({ path, content, type });
    return () => setActiveDocument(null);
  }, [path, content, saveState, setActiveDocument, isImage]);

  const isCanvas = path.toLowerCase().endsWith(".canvas");
  const frontType = isCanvas ? undefined : getFrontmatterType(content);
  const isBoard = frontType === "board";
  const isTable = frontType === "table";
  const isMermaid = frontType === "mermaid";
  const isCalendar = frontType === "calendar";
  const isGrid = frontType === "grid";
  const canFind =
    !isImage && !isCanvas && !isBoard && !isTable && !isMermaid && !isCalendar && !isGrid;
  const canToggleMode = canFind && !disableModeToggle;
  const renderedWidthOverride = canFind ? readRenderedWidthOverride(content) : undefined;
  const defaultRenderedWidth = parseRenderedWidthMode(settings.renderedWidthDefault) ?? "normal";
  const renderedWidth: RenderedWidthMode = renderedWidthOverride ?? defaultRenderedWidth;
  const selectedRenderedWidthOverride: RenderedWidthOverride = renderedWidthOverride ?? "unset";

  useEffect(() => {
    if (!canFind && findOpen) {
      setFindOpen(false);
    }
  }, [canFind, findOpen]);

  const runEditCommand = (command: string, target: HTMLElement | null) => {
    target?.focus();
    document.execCommand(command);
    ctxMenu.close();
  };

  const contextMenuItems = useMemo(() => {
    const target = ctxMenu.menu?.data ?? null;
    const items: ContextMenuEntry[] = [];
    items.push(
      { label: "Undo", run: () => runEditCommand("undo", target) },
      { label: "Redo", run: () => runEditCommand("redo", target) },
      { separator: true },
      { label: "Cut", run: () => runEditCommand("cut", target) },
      { label: "Copy", run: () => runEditCommand("copy", target) },
      { label: "Paste", run: () => runEditCommand("paste", target) },
      { label: "Select All", run: () => runEditCommand("selectAll", target) },
    );
    return items;
  }, [ctxMenu.menu?.data]);

  if (saveState === "loading") {
    return <div className="note-loading">Loading…</div>;
  }

  const applyReplace = (next: string) => {
    setContent(next);
    handleChange(next);
  };

  return (
    <div
      className={`note-editor ${canFind ? `note-editor--render-width-${renderedWidth}` : ""}`}
      onKeyDown={(event) => {
        if (canFind && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
          event.preventDefault();
          setFindOpen(true);
        }
      }}
    >
      <div
        className="note-editor-region"
        ref={regionRef}
        onContextMenu={(event: MouseEvent<HTMLDivElement>) => {
          const target = event.target as HTMLElement | null;
          if (!target || target.closest(".context-menu")) {
            return;
          }
          event.preventDefault();
          ctxMenu.open({ x: event.clientX, y: event.clientY }, target);
        }}
      >
        {canToggleMode && (
          <div className="mode-float">
            <div className="mode-switch mode-switch--floating" role="tablist">
              {EDITOR_MODES.map((candidate) => (
                <button
                  key={candidate}
                  role="tab"
                  aria-selected={candidate === mode}
                  className={`mode-btn ${candidate === mode ? "mode-btn--active" : ""}`}
                  onClick={() => {
                    setMode(candidate);
                    persistSession(candidate, markdownViewStateRef.current);
                  }}
                >
                  {MODE_LABEL[candidate]}
                </button>
              ))}
            </div>
            {mode === "split" && (
              <button
                type="button"
                className={`mode-sync-toggle ${splitScrollSync ? "mode-sync-toggle--on" : ""}`}
                onClick={() =>
                  setSplitScrollSync((prev) => {
                    const next = !prev;
                    markdownViewStateRef.current = {
                      ...markdownViewStateRef.current,
                      splitScrollSync: next,
                    };
                    persistSession(mode, markdownViewStateRef.current);
                    return next;
                  })
                }
                title="Sync scroll positions between source and rendered panes"
                aria-pressed={splitScrollSync}
              >
                Sync scroll
              </button>
            )}
            <span className={`save-status save-status--${saveState}`}>{SAVE_LABEL[saveState]}</span>
          </div>
        )}
        {isImage ? (
          <div className="image-note">
            <NoteToolbar
              label="Image"
              className="image-note-toolbar"
              trailing={<span className="image-note-path">{path}</span>}
            >
              <span className="note-type-badge">Image</span>
            </NoteToolbar>
            <div className="image-note-body">
              <img className="image-note-preview" src={api.fileRawUrl(path)} alt={basename(path)} />
            </div>
          </div>
        ) : isCanvas ? (
          <CanvasView
            key={path}
            path={path}
            value={content}
            onChange={handleChange}
            onOpenFile={(target) =>
              dispatch({ type: "openFile", path: target, title: basename(target) })
            }
            subscribeToFileChange={subscribeToFileChange}
          />
        ) : isBoard ? (
          <BoardView
            value={content}
            onChange={handleChange}
            path={path}
            onOpenWikilink={(name) => {
              void (async () => {
                const resolved = await api.resolve(name);
                if (resolved.path) {
                  dispatch({ type: "openFile", path: resolved.path, title: name });
                }
              })();
            }}
          />
        ) : isTable ? (
          <TableGrid value={content} onChange={handleChange} />
        ) : isMermaid ? (
          <MermaidView
            value={content}
            onChange={handleChange}
            modes={disableModeToggle ? [] : undefined}
            defaultMode={disableModeToggle ? "preview" : undefined}
          />
        ) : isCalendar ? (
          <CalendarView value={content} onChange={handleChange} path={path} />
        ) : isGrid ? (
          <GridView value={content} onChange={handleChange} />
        ) : (
          <MarkdownEditor
            value={content}
            mode={mode}
            onChange={handleChange}
            callbacks={callbacks}
            viewState={markdownViewStateRef.current}
            syncSplitScroll={splitScrollSync}
            onViewStateChange={(patch) => {
              markdownViewStateRef.current = { ...markdownViewStateRef.current, ...patch };
              persistSession(mode, markdownViewStateRef.current);
            }}
            disableToolbarInEdit
            toolbarTrailing={
              canFind ? (
                <div className="editor-toolbar-meta">
                  <label className="editor-width-control">
                    <span className="editor-width-label">Width</span>
                    <select
                      className="editor-width-select"
                      aria-label="Rendered width override"
                      value={selectedRenderedWidthOverride}
                      onChange={(event) => {
                        const next = event.target.value as RenderedWidthOverride;
                        const nextContent = applyRenderedWidthOverride(content, next);
                        if (nextContent !== content) {
                          handleChange(nextContent);
                        }
                      }}
                    >
                      <option value="unset">Unset (use default)</option>
                      <option value="normal">Normal</option>
                      <option value="wide">Wide</option>
                    </select>
                  </label>
                  <div className="editor-find-wrap">
                    <button
                      className="editor-find-btn"
                      title="Find in note (Ctrl/Cmd+F)"
                      aria-label="Find in note"
                      aria-expanded={findOpen}
                      onClick={() => setFindOpen((open) => !open)}
                    >
                      🔍 Find
                    </button>
                    {findOpen && (
                      <div className="editor-find-popout">
                        <FindBar
                          regionRef={regionRef}
                          content={content}
                          onReplace={applyReplace}
                          onClose={() => setFindOpen(false)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : undefined
            }
          />
        )}
      </div>

      {ctxMenu.menu && (
        <ContextMenu
          position={ctxMenu.menu.position}
          items={contextMenuItems}
          onClose={ctxMenu.close}
          menuRef={ctxMenu.menuRef}
        />
      )}
    </div>
  );
}
