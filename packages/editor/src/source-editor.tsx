import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { Annotation, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef, type MutableRefObject } from "react";
import { droppedPathInsertion, NOTES_PATH_MIME } from "./types";
import type { EditorCallbacks } from "./types";

const externalSync = Annotation.define<boolean>();

/**
 * CodeMirror extension that handles drops of notes from the explorer.
 * Alt held → plain link; otherwise embed.
 */
function notesDropExtension(callbacksRef: MutableRefObject<EditorCallbacks | undefined>) {
  return EditorView.domEventHandlers({
    dragover(event) {
      if (
        event.dataTransfer?.types.includes(NOTES_PATH_MIME) ||
        (event.dataTransfer?.files.length ?? 0) > 0
      ) {
        event.preventDefault();
      }
      return false;
    },
    drop(event, view) {
      const path = event.dataTransfer?.getData(NOTES_PATH_MIME);
      if (path) {
        event.preventDefault();
        const text = droppedPathInsertion(path, event.altKey);
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos != null) {
          view.dispatch({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length } });
        }
        return true;
      }
      const file = event.dataTransfer?.files?.[0];
      const onImportFile = callbacksRef.current?.onImportFile;
      if (!file || !onImportFile) {
        return false;
      }
      event.preventDefault();
      const insertAt = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.from;
      void onImportFile(file).then((insert) => {
        if (!insert) {
          return;
        }
        view.dispatch({
          changes: { from: insertAt, to: insertAt, insert },
          selection: { anchor: insertAt + insert.length },
        });
      });
      return true;
    },
    paste(event, view) {
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === "file")
        ?.getAsFile();
      const onImportFile = callbacksRef.current?.onImportFile;
      if (!file || !onImportFile) {
        return false;
      }
      event.preventDefault();
      const range = view.state.selection.main;
      void onImportFile(file).then((insert) => {
        if (!insert) {
          return;
        }
        view.dispatch({
          changes: { from: range.from, to: range.to, insert },
          selection: { anchor: range.from + insert.length },
        });
      });
      return true;
    },
  });
}

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  callbacks?: EditorCallbacks;
}

/** Plain markdown source editor (CodeMirror 6). */
export function SourceEditor({ value, onChange, callbacks }: SourceEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const callbacksRef = useRef(callbacks);
  onChangeRef.current = onChange;
  callbacksRef.current = callbacks;

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
          notesDropExtension(callbacksRef),
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
