import { MarkdownEditor, EDITOR_MODES, type EditorCallbacks, type EditorMode } from "@notes/editor";
import { CanvasView } from "@notes/note-canvas";
import { TableGrid } from "@notes/note-tables";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { connectTomeChanges } from "../api/ws";
import { useWorkspace } from "../state/app-context";

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
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<EditorMode>("rendered");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const dirtyRef = useRef(false);
  const contentRef = useRef("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

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
        dirtyRef.current = false;
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [path],
  );

  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      contentRef.current = value;
      dirtyRef.current = true;
      setSaveState("unsaved");
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      saveTimer.current = setTimeout(() => void save(value), 600);
    },
    [save],
  );

  // Reload on external changes when there are no unsaved local edits.
  useEffect(() => {
    return connectTomeChanges((change) => {
      if (change.path !== path) {
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

  if (saveState === "loading") {
    return <div className="note-loading">Loading…</div>;
  }

  const isCanvas = path.toLowerCase().endsWith(".canvas");
  const isTable = !isCanvas && getFrontmatterType(content) === "table";

  return (
    <div className="note-editor">
      <div className="editor-toolbar-row">
        {isCanvas ? (
          <span className="note-type-badge">Canvas</span>
        ) : isTable ? (
          <span className="note-type-badge">Table</span>
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
      </div>
      {isCanvas ? (
        <CanvasView
          key={path}
          path={path}
          value={content}
          onChange={handleChange}
          onOpenFile={(target) => dispatch({ type: "openFile", path: target, title: basename(target) })}
        />
      ) : isTable ? (
        <TableGrid value={content} onChange={handleChange} />
      ) : (
        <MarkdownEditor value={content} mode={mode} onChange={handleChange} callbacks={callbacks} />
      )}
    </div>
  );
}
