import { useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

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

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkPopoverRef = useRef<HTMLDivElement>(null);

  // Close the link popover when the user clicks outside it.
  useEffect(() => {
    if (!linkOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (linkPopoverRef.current && !linkPopoverRef.current.contains(event.target as Node)) {
        setLinkOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [linkOpen]);

  const openLinkPopover = () => {
    if (!editor) return;
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    setLinkUrl(prev);
    setLinkOpen(true);
  };

  const applyLink = () => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (linkUrl.trim() === "") {
      chain.unsetLink().run();
    } else {
      chain.setLink({ href: linkUrl.trim() }).run();
    }
    setLinkOpen(false);
  };

  const removeLink = () => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
    setLinkOpen(false);
  };

  const active = state ?? EMPTY_STATE;
  const isDisabled = disabled || !editor;
  const chain = () => editor!.chain().focus();

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
        <div className="tb-link-wrap" ref={linkPopoverRef}>
          <button
            type="button"
            title="Link"
            aria-expanded={linkOpen}
            aria-haspopup="dialog"
            disabled={isDisabled}
            className={`tb-btn ${editor?.isActive("link") ? "tb-btn--active" : ""}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={openLinkPopover}
          >
            🔗
          </button>
          {linkOpen && (
            <div className="tb-link-popover" role="dialog" aria-label="Insert link">
              <input
                className="tb-link-input"
                type="url"
                autoFocus
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }
                  if (event.key === "Escape") {
                    setLinkOpen(false);
                  }
                }}
              />
              <div className="tb-link-actions">
                <button type="button" className="tb-link-ok" onClick={applyLink}>
                  Set
                </button>
                <button type="button" className="tb-link-remove" onClick={removeLink}>
                  Remove
                </button>
                <button type="button" className="tb-link-cancel" onClick={() => setLinkOpen(false)}>
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
        {button("hr", "―", "Horizontal rule", false, () => chain().setHorizontalRule().run())}
      </div>
      {trailing && <div className="editor-toolbar-trailing">{trailing}</div>}
    </div>
  );
}
