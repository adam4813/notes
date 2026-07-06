import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { Markdown } from "tiptap-markdown";

interface MarkdownStorage {
  markdown: { getMarkdown: () => string };
}

function readMarkdown(instance: Editor): string {
  return (instance.storage as unknown as MarkdownStorage).markdown.getMarkdown();
}

interface RenderedEditorProps {
  value: string;
  onChange: (markdown: string) => void;
}

/** WYSIWYG editor (TipTap/ProseMirror) that reads and writes markdown. */
export function RenderedEditor({ value, onChange }: RenderedEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({ html: false, tightLists: true }),
    ],
    onUpdate: ({ editor: instance }) => {
      onChangeRef.current(readMarkdown(instance));
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    if (value !== readMarkdown(editor)) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  return <EditorContent editor={editor} className="tiptap-host" />;
}
