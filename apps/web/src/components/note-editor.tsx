import {
  MarkdownEditor,
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
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { api } from "../api/client";
import { fitMenuToViewport } from "../lib/context-menu";
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
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<EditorMode>(defaultMode);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [findOpen, setFindOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuTargetRef = useRef<HTMLElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const contentRef = useRef("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastWriteAtRef = useRef(0);
  // Always-current ref so the unmount cleanup can flush the right path/content.
  const pathRef = useRef(path);
  pathRef.current = path;
  const isImage = isImagePath(path);

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

  useEffect(() => {
    if (!canFind && findOpen) {
      setFindOpen(false);
    }
  }, [canFind, findOpen]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    if (contextMenuRef.current) {
      const next = fitMenuToViewport(contextMenu, contextMenuRef.current);
      if (next.x !== contextMenu.x || next.y !== contextMenu.y) {
        setContextMenu(next);
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  if (saveState === "loading") {
    return <div className="note-loading">Loading…</div>;
  }

  const applyReplace = (next: string) => {
    setContent(next);
    handleChange(next);
  };

  const runEditCommand = (command: string) => {
    contextMenuTargetRef.current?.focus();
    document.execCommand(command);
    setContextMenu(null);
  };

  return (
    <div
      className="note-editor"
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
          contextMenuTargetRef.current = target;
          setContextMenu({ x: event.clientX, y: event.clientY });
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
                  onClick={() => setMode(candidate)}
                >
                  {MODE_LABEL[candidate]}
                </button>
              ))}
            </div>
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
            modes={!canToggleMode ? [] : undefined}
            defaultMode={mode === "rendered" ? "preview" : "split"}
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
            disableToolbarInEdit
            toolbarTrailing={
              canFind ? (
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
              ) : undefined
            }
          />
        )}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="context-menu editor-context-menu"
            role="menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button role="menuitem" className="context-item" onClick={() => runEditCommand("undo")}>
              Undo
            </button>
            <button role="menuitem" className="context-item" onClick={() => runEditCommand("redo")}>
              Redo
            </button>
            <div className="context-sep" />
            <button role="menuitem" className="context-item" onClick={() => runEditCommand("cut")}>
              Cut
            </button>
            <button role="menuitem" className="context-item" onClick={() => runEditCommand("copy")}>
              Copy
            </button>
            <button
              role="menuitem"
              className="context-item"
              onClick={() => runEditCommand("paste")}
            >
              Paste
            </button>
            <button
              role="menuitem"
              className="context-item"
              onClick={() => runEditCommand("selectAll")}
            >
              Select all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
