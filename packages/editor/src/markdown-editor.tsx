import { RenderedEditor } from "./rendered-editor";
import { SourceEditor } from "./source-editor";
import type { EditorCallbacks, EditorMode } from "./types";

interface MarkdownEditorProps {
  value: string;
  mode: EditorMode;
  onChange: (markdown: string) => void;
  callbacks?: EditorCallbacks;
}

/**
 * Hybrid markdown editor. A single `value` (markdown) drives both a CodeMirror
 * source view and a TipTap rendered view; in split mode both are shown and stay
 * in sync through the shared value.
 */
export function MarkdownEditor({ value, mode, onChange, callbacks }: MarkdownEditorProps) {
  const showSource = mode === "edit" || mode === "split";
  const showRendered = mode === "rendered" || mode === "split";

  return (
    <div className={`markdown-editor markdown-editor--${mode}`}>
      {showSource && (
        <div className="editor-column editor-column--source">
          <SourceEditor value={value} onChange={onChange} />
        </div>
      )}
      {showRendered && (
        <div className="editor-column editor-column--rendered">
          <RenderedEditor value={value} onChange={onChange} callbacks={callbacks} />
        </div>
      )}
    </div>
  );
}
