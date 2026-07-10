import { useEditorState, type Editor } from "@tiptap/react";
import type { ReactNode } from "react";

interface EditorToolbarProps {
  editor: Editor | null;
  disabled?: boolean;
  trailing?: ReactNode;
}

interface ToolbarState {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  h1: boolean;
  h2: boolean;
  h3: boolean;
  bullet: boolean;
  ordered: boolean;
  task: boolean;
  quote: boolean;
  codeBlock: boolean;
}

const EMPTY_STATE: ToolbarState = {
  bold: false,
  italic: false,
  strike: false,
  code: false,
  h1: false,
  h2: false,
  h3: false,
  bullet: false,
  ordered: false,
  task: false,
  quote: false,
  codeBlock: false,
};

export function EditorToolbar({ editor, disabled = false, trailing }: EditorToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }): ToolbarState =>
      instance
        ? {
            bold: instance.isActive("bold"),
            italic: instance.isActive("italic"),
            strike: instance.isActive("strike"),
            code: instance.isActive("code"),
            h1: instance.isActive("heading", { level: 1 }),
            h2: instance.isActive("heading", { level: 2 }),
            h3: instance.isActive("heading", { level: 3 }),
            bullet: instance.isActive("bulletList"),
            ordered: instance.isActive("orderedList"),
            task: instance.isActive("taskList"),
            quote: instance.isActive("blockquote"),
            codeBlock: instance.isActive("codeBlock"),
          }
        : EMPTY_STATE,
  });

  const active = state ?? EMPTY_STATE;
  const isDisabled = disabled || !editor;
  const chain = () => editor!.chain().focus();

  const setLink = () => {
    if (!editor) {
      return;
    }
    const previous = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("Link URL", previous);
    if (url === null) {
      return;
    }
    if (url === "") {
      chain().unsetLink().run();
    } else {
      chain().toggleLink({ href: url }).run();
    }
  };

  const button = (key: string, label: string, title: string, isActive: boolean, run: () => void) => (
    <button
      key={key}
      type="button"
      title={title}
      aria-pressed={isActive}
      disabled={isDisabled}
      className={`tb-btn ${isActive ? "tb-btn--active" : ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={run}
    >
      {label}
    </button>
  );

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Formatting">
      <div className="editor-toolbar-main">
        {button("bold", "B", "Bold (Ctrl+B)", active.bold, () => chain().toggleBold().run())}
        {button("italic", "I", "Italic (Ctrl+I)", active.italic, () => chain().toggleItalic().run())}
        {button("strike", "S", "Strikethrough", active.strike, () => chain().toggleStrike().run())}
        {button("code", "</>", "Inline code", active.code, () => chain().toggleCode().run())}
        <span className="tb-sep" />
        {button("h1", "H1", "Heading 1", active.h1, () => chain().toggleHeading({ level: 1 }).run())}
        {button("h2", "H2", "Heading 2", active.h2, () => chain().toggleHeading({ level: 2 }).run())}
        {button("h3", "H3", "Heading 3", active.h3, () => chain().toggleHeading({ level: 3 }).run())}
        <span className="tb-sep" />
        {button("ul", "• List", "Bullet list", active.bullet, () => chain().toggleBulletList().run())}
        {button("ol", "1. List", "Ordered list", active.ordered, () => chain().toggleOrderedList().run())}
        {button("task", "☑ Task", "Task list", active.task, () => chain().toggleTaskList().run())}
        <span className="tb-sep" />
        {button("quote", "❝", "Blockquote", active.quote, () => chain().toggleBlockquote().run())}
        {button("codeblock", "{ }", "Code block", active.codeBlock, () =>
          chain().toggleCodeBlock().run(),
        )}
        {button("link", "🔗", "Link", false, setLink)}
        {button("hr", "―", "Horizontal rule", false, () => chain().setHorizontalRule().run())}
      </div>
      {trailing && <div className="editor-toolbar-trailing">{trailing}</div>}
    </div>
  );
}
