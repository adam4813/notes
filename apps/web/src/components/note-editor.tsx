import { MarkdownEditor, EDITOR_MODES, type EditorCallbacks, type EditorMode } from "@notes/editor";
import { CanvasView } from "@notes/note-canvas";
import { BoardView } from "@notes/note-boards";
import { CalendarView } from "@notes/note-calendar";
import { GridView } from "@notes/note-grid";
import { MermaidView } from "@notes/note-mermaid";
import { TableGrid } from "@notes/note-tables";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { connectTomeChanges } from "../api/ws";
import { useAppServices } from "../state/app-services";
import { useWorkspace } from "../state/app-context";
import { useToasts } from "../state/toast";
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

type SaveState = "loading" | "saved" | "saving" | "unsaved" | "error" | "external";

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
};

export function NoteEditor({ path }: { path: string }) {
  const { dispatch } = useWorkspace();
  const { markModified, setActiveDocument } = useAppServices();
  const { notify } = useToasts();
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<EditorMode>("rendered");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [findOpen, setFindOpen] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const contentRef = useRef("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastWriteAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setSaveState("loading");
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
  }, [path]);

  const save = useCallback(
    async (value: string) => {
      setSaveState("saving");
      try {
        await api.write(path, value);
        lastWriteAtRef.current = Date.now();
        dirtyRef.current = false;
        setSaveState("saved");
      } catch {
        setSaveState("error");
        notify("Couldn't save changes — they're kept in the editor. Retrying may help.", {
          kind: "error",
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
  }, [path]);

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
    }),
    [dispatch],
  );

  // Publish the active document to plugins (word count, etc.).
  useEffect(() => {
    if (saveState === "loading") {
      return;
    }
    const type = path.toLowerCase().endsWith(".canvas")
      ? "canvas"
      : getFrontmatterType(content) ?? "markdown";
    setActiveDocument({ path, content, type });
    return () => setActiveDocument(null);
  }, [path, content, saveState, setActiveDocument]);

  if (saveState === "loading") {
    return <div className="note-loading">Loading…</div>;
  }

  const isCanvas = path.toLowerCase().endsWith(".canvas");
  const frontType = isCanvas ? undefined : getFrontmatterType(content);
  const isBoard = frontType === "board";
  const isTable = frontType === "table";
  const isMermaid = frontType === "mermaid";
  const isCalendar = frontType === "calendar";
  const isGrid = frontType === "grid";
  const canFind = !isCanvas && !isBoard && !isTable && !isMermaid && !isCalendar && !isGrid;

  const applyReplace = (next: string) => {
    setContent(next);
    handleChange(next);
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
      <div className="editor-toolbar-row">
        {isCanvas ? (
          <span className="note-type-badge">Canvas</span>
        ) : isBoard ? (
          <span className="note-type-badge">Board</span>
        ) : isTable ? (
          <span className="note-type-badge">Table</span>
        ) : isMermaid ? (
          <span className="note-type-badge">Mermaid</span>
        ) : isCalendar ? (
          <span className="note-type-badge">Calendar</span>
        ) : isGrid ? (
          <span className="note-type-badge">Grid</span>
        ) : (
          <div className="mode-switch" role="tablist">
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
        )}
        <span className={`save-status save-status--${saveState}`}>{SAVE_LABEL[saveState]}</span>
        {canFind && !findOpen && (
          <button
            className="editor-find-btn"
            title="Find in note (Ctrl/Cmd+F)"
            aria-label="Find in note"
            onClick={() => setFindOpen(true)}
          >
            🔍
          </button>
        )}
        {canFind && findOpen && (
          <FindBar
            regionRef={regionRef}
            content={content}
            onReplace={applyReplace}
            onClose={() => setFindOpen(false)}
          />
        )}
      </div>
      <div className="note-editor-region" ref={regionRef}>
        {isCanvas ? (
          <CanvasView
            key={path}
            path={path}
            value={content}
            onChange={handleChange}
            onOpenFile={(target) =>
              dispatch({ type: "openFile", path: target, title: basename(target) })
            }
          />
        ) : isBoard ? (
          <BoardView value={content} onChange={handleChange} />
        ) : isTable ? (
          <TableGrid value={content} onChange={handleChange} />
        ) : isMermaid ? (
          <MermaidView value={content} onChange={handleChange} />
        ) : isCalendar ? (
          <CalendarView value={content} onChange={handleChange} />
        ) : isGrid ? (
          <GridView value={content} onChange={handleChange} />
        ) : (
          <MarkdownEditor value={content} mode={mode} onChange={handleChange} callbacks={callbacks} />
        )}
      </div>
    </div>
  );
}
