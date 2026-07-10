import { useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePromptDialog } from "./prompt-dialog";

interface EditorToolbarProps {
  editor: Editor | null;
  disabled?: boolean;
  trailing?: ReactNode;
}

interface ToolbarState {
  canUndo: boolean;
  canRedo: boolean;
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
  textColor: string | null;
  backgroundColor: string | null;
}

const EMPTY_STATE: ToolbarState = {
  canUndo: false,
  canRedo: false,
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
  textColor: null,
  backgroundColor: null,
};

function asColorInputValue(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (/^#[0-9a-f]{6}$/.test(normalized)) {
    return normalized;
  }
  const shortHex = /^#([0-9a-f]{3})$/.exec(normalized);
  if (shortHex) {
    return `#${shortHex[1]
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})/.exec(normalized);
  if (rgb) {
    const toHex = (part: string) =>
      Math.max(0, Math.min(255, Number(part)))
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`;
  }
  return fallback;
}

export function EditorToolbar({ editor, disabled = false, trailing }: EditorToolbarProps) {
  const { openPrompt, promptDialog } = usePromptDialog();
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }): ToolbarState =>
      instance
        ? {
            canUndo: instance.can().chain().focus().undo().run(),
            canRedo: instance.can().chain().focus().redo().run(),
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
            textColor:
              (instance.getAttributes("styledText").color as string | null | undefined) ?? null,
            backgroundColor:
              (instance.getAttributes("styledText").backgroundColor as string | null | undefined) ??
              null,
          }
        : EMPTY_STATE,
  });

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkPopoverRef = useRef<HTMLDivElement>(null);
  const colorSelectionRef = useRef<{ from: number; to: number } | null>(null);

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

  useEffect(() => {
    if (!editor) {
      return;
    }
    const syncSelection = () => {
      const { from, to, empty } = editor.state.selection;
      if (!empty) {
        colorSelectionRef.current = { from, to };
      }
    };
    editor.on("selectionUpdate", syncSelection);
    return () => {
      editor.off("selectionUpdate", syncSelection);
    };
  }, [editor]);

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
  const rememberSelection = () => {
    if (!editor) {
      return;
    }
    const { from, to, empty } = editor.state.selection;
    colorSelectionRef.current = empty ? null : { from, to };
  };
  const setStyledText = (patch: { color?: string | null; backgroundColor?: string | null }) => {
    if (!editor) {
      return;
    }
    const attrs = editor.getAttributes("styledText") as {
      color?: string | null;
      backgroundColor?: string | null;
    };
    const nextColor = patch.color === undefined ? (attrs.color ?? null) : patch.color;
    const nextBackground =
      patch.backgroundColor === undefined ? (attrs.backgroundColor ?? null) : patch.backgroundColor;
    const nextAttrs = {
      color: nextColor?.trim() || null,
      backgroundColor: nextBackground?.trim() || null,
    };
    const currentSelection = editor.state.selection;
    const targetSelection =
      currentSelection.empty && colorSelectionRef.current ? colorSelectionRef.current : null;
    const markChain = editor.chain().focus();
    if (targetSelection) {
      markChain.setTextSelection(targetSelection);
    }
    if (!nextAttrs.color && !nextAttrs.backgroundColor) {
      markChain.unsetMark("styledText").run();
      return;
    }
    markChain.setMark("styledText", nextAttrs).run();
    colorSelectionRef.current = targetSelection ?? {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
  };
  const hasTextStyle = Boolean(active.textColor || active.backgroundColor);
  const insertImage = async () => {
    if (!editor) {
      return;
    }
    const values = await openPrompt({
      title: "Insert image",
      fields: [
        { key: "src", label: "Image URL", type: "url", defaultValue: "https://", required: true },
        { key: "alt", label: "Alt text", defaultValue: "" },
        { key: "title", label: "Title", defaultValue: "" },
      ],
      confirmLabel: "Insert",
    });
    if (!values) {
      return;
    }
    const src = values.src.trim();
    if (!src) {
      return;
    }
    const alt = values.alt.trim();
    const title = values.title.trim();
    editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: {
          src,
          ...(alt ? { alt } : {}),
          ...(title ? { title } : {}),
        },
      })
      .run();
  };

  const button = (
    key: string,
    label: string,
    title: string,
    isActive: boolean,
    run: () => void,
    disabledWhen = false,
  ) => (
    <button
      key={key}
      type="button"
      title={title}
      aria-pressed={isActive}
      disabled={isDisabled || disabledWhen}
      className={`tb-btn ${isActive ? "tb-btn--active" : ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={run}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="editor-toolbar" role="toolbar" aria-label="Formatting">
        <div className="editor-toolbar-main">
          {button("undo", "↶", "Undo (Ctrl+Z)", false, () => chain().undo().run(), !active.canUndo)}
          {button("redo", "↷", "Redo (Ctrl+Y)", false, () => chain().redo().run(), !active.canRedo)}
          <span className="tb-sep" />
          {button("bold", "B", "Bold (Ctrl+B)", active.bold, () => chain().toggleBold().run())}
          {button("italic", "I", "Italic (Ctrl+I)", active.italic, () =>
            chain().toggleItalic().run(),
          )}
          {button("strike", "S", "Strikethrough", active.strike, () =>
            chain().toggleStrike().run(),
          )}
          {button("code", "</>", "Inline code", active.code, () => chain().toggleCode().run())}
          <span className="tb-sep" />
          {button("h1", "H1", "Heading 1", active.h1, () =>
            chain().toggleHeading({ level: 1 }).run(),
          )}
          {button("h2", "H2", "Heading 2", active.h2, () =>
            chain().toggleHeading({ level: 2 }).run(),
          )}
          {button("h3", "H3", "Heading 3", active.h3, () =>
            chain().toggleHeading({ level: 3 }).run(),
          )}
          <span className="tb-sep" />
          {button("ul", "• List", "Bullet list", active.bullet, () =>
            chain().toggleBulletList().run(),
          )}
          {button("ol", "1. List", "Ordered list", active.ordered, () =>
            chain().toggleOrderedList().run(),
          )}
          {button("task", "☑ Task", "Task list", active.task, () => chain().toggleTaskList().run())}
          <span className="tb-sep" />
          {button("quote", "❝", "Blockquote", active.quote, () => chain().toggleBlockquote().run())}
          {button("codeblock", "{ }", "Code block", active.codeBlock, () =>
            chain().toggleCodeBlock().run(),
          )}
          <span className="tb-sep" />
          <label className="tb-color-picker" title="Text color">
            <span className="tb-color-label">A</span>
            <input
              type="color"
              aria-label="Text color"
              disabled={isDisabled}
              className="tb-color-input"
              value={asColorInputValue(active.textColor, "#111827")}
              onPointerDown={rememberSelection}
              onInput={(event) => setStyledText({ color: event.currentTarget.value })}
              onChange={(event) => setStyledText({ color: event.target.value })}
            />
          </label>
          <label className="tb-color-picker" title="Background color">
            <span className="tb-color-label tb-color-label--bg">▦</span>
            <input
              type="color"
              aria-label="Background color"
              disabled={isDisabled}
              className="tb-color-input"
              value={asColorInputValue(active.backgroundColor, "#fef08a")}
              onPointerDown={rememberSelection}
              onInput={(event) => setStyledText({ backgroundColor: event.currentTarget.value })}
              onChange={(event) => setStyledText({ backgroundColor: event.target.value })}
            />
          </label>
          {button("clear-style", "Tx", "Clear text and background color", hasTextStyle, () =>
            setStyledText({ color: null, backgroundColor: null }),
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
                  <button
                    type="button"
                    className="tb-link-cancel"
                    onClick={() => setLinkOpen(false)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
          {button("image", "🖼", "Insert image by URL", false, () => void insertImage())}
          {button("hr", "―", "Horizontal rule", false, () => chain().setHorizontalRule().run())}
        </div>
        {trailing && <div className="editor-toolbar-trailing">{trailing}</div>}
      </div>
      {promptDialog}
    </>
  );
}
