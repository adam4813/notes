import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { Annotation, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef } from "react";

const externalSync = Annotation.define<boolean>();

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
