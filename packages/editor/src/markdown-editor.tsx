import type { ReactNode } from "react";
import { EditorToolbar } from "./toolbar";
import { RenderedEditor } from "./rendered-editor";
import { SourceEditor } from "./source-editor";
import type { EditorCallbacks, EditorMode } from "./types";

interface MarkdownEditorProps {
  value: string;
  mode: EditorMode;
  onChange: (markdown: string) => void;
  callbacks?: EditorCallbacks;
  toolbarTrailing?: ReactNode;
  disableToolbarInEdit?: boolean;
}

/**
 * Hybrid markdown editor. A single `value` (markdown) drives both a CodeMirror
 * source view and a TipTap rendered view; in split mode both are shown and stay
 * in sync through the shared value.
 */
export function MarkdownEditor({
  value,
  mode,
  onChange,
  callbacks,
  toolbarTrailing,
  disableToolbarInEdit = false,
}: MarkdownEditorProps) {
  const showSource = mode === "edit" || mode === "split";
  const showRendered = mode === "rendered" || mode === "split";

  return (
    <div className={`markdown-editor-shell markdown-editor-shell--${mode}`}>
      {mode === "edit" && disableToolbarInEdit && (
        <EditorToolbar editor={null} disabled trailing={toolbarTrailing} />
      )}
      <div className={`markdown-editor markdown-editor--${mode}`}>
        {showSource && (
          <div className="editor-column editor-column--source">
            <SourceEditor value={value} onChange={onChange} callbacks={callbacks} />
          </div>
        )}
        {showRendered && (
          <div className="editor-column editor-column--rendered">
            <RenderedEditor
              value={value}
              onChange={onChange}
              callbacks={callbacks}
              toolbarTrailing={toolbarTrailing}
            />
          </div>
        )}
      </div>
    </div>
  );
}
