import { MarkdownEditor, EDITOR_MODES, type EditorMode } from "@notes/editor";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { connectTomeChanges } from "../api/ws";

type SaveState = "loading" | "saved" | "saving" | "error" | "external";

const MODE_LABEL: Record<EditorMode, string> = {
  edit: "Edit",
  split: "Split",
  rendered: "Rendered",
};

const SAVE_LABEL: Record<SaveState, string> = {
  loading: "Loading…",
  saved: "Saved",
  saving: "Saving…",
  error: "Save failed",
  external: "Changed on disk",
};

export function NoteEditor({ path }: { path: string }) {
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

  return (
    <div className="note-editor">
      <div className="editor-toolbar-row">
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
        <span className={`save-status save-status--${saveState}`}>{SAVE_LABEL[saveState]}</span>
      </div>
      <MarkdownEditor value={content} mode={mode} onChange={handleChange} />
    </div>
  );
}
