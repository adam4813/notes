import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { Annotation, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { NOTES_PATH_MIME, noteNameFromPath } from "./types";

const externalSync = Annotation.define<boolean>();

/**
 * CodeMirror extension that handles drops of notes from the explorer.
 * Alt held → plain link; otherwise embed.
 */
function notesDropExtension() {
  return EditorView.domEventHandlers({
    dragover(event) {
      if (event.dataTransfer?.types.includes(NOTES_PATH_MIME)) {
        event.preventDefault();
      }
      return false;
    },
    drop(event, view) {
      const path = event.dataTransfer?.getData(NOTES_PATH_MIME);
      if (!path) {
        return false;
      }
      event.preventDefault();
      const name = noteNameFromPath(path);
      const text = event.altKey ? `[[${name}]]` : `![[${name}]]`;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos != null) {
        view.dispatch({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length } });
      }
      return true;
    },
  });
}

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
}

/** Plain markdown source editor (CodeMirror 6). */
export function SourceEditor({ value, onChange }: SourceEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          EditorView.lineWrapping,
          notesDropExtension(),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) {
              return;
            }
            const isExternal = update.transactions.some((tr) => tr.annotation(externalSync));
            if (!isExternal) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        annotations: externalSync.of(true),
      });
    }
  }, [value]);

  return <div className="cm-host" ref={hostRef} />;
}
