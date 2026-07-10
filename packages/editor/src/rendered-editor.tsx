import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Markdown } from "tiptap-markdown";
import { Embed } from "./embed-extension";
import { SuggestionPopup } from "./suggestion-popup";
import { NOTES_PATH_MIME, noteNameFromPath } from "./types";
import { EditorToolbar } from "./toolbar";
import type { EditorCallbacks, WikiSuggestion } from "./types";
import { WikilinkDecorator } from "./wikilink-decorator";

interface MarkdownStorage {
  markdown: { getMarkdown: () => string };
}

/**
 * Reads markdown from the editor and unescapes auto-escaped brackets so
 * `[[wikilinks]]` and `[text]` survive the round-trip (matching what the source
 * editor writes).
 */
function readMarkdown(instance: Editor): string {
  const markdown = (instance.storage as unknown as MarkdownStorage).markdown.getMarkdown();
  return markdown.replace(/\\([[\]])/g, "$1").replace(/\\#(?=[\p{L}\p{N}])/gu, "#");
}

type SuggestKind = "wikilink" | "tag";

interface SuggestState {
  kind: SuggestKind;
  /** True when the wikilink is an embed (`![[...]]`). */
  embed?: boolean;
  from: number;
  to: number;
  items: string[];
  index: number;
  left: number;
  top: number;
}

interface RenderedEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  callbacks?: EditorCallbacks;
  toolbarTrailing?: ReactNode;
  toolbarDisabled?: boolean;
}

/** WYSIWYG editor (TipTap/ProseMirror): toolbar, clickable wikilinks, and autocomplete. */
export function RenderedEditor({
  value,
  onChange,
  callbacks,
  toolbarTrailing,
  toolbarDisabled = false,
}: RenderedEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const containerRef = useRef<HTMLDivElement>(null);
  const [suggest, setSuggest] = useState<SuggestState | null>(null);
  const suggestRef = useRef<SuggestState | null>(null);
  suggestRef.current = suggest;
  const actionsRef = useRef<{
    move: (delta: number) => void;
    apply: () => void;
    close: () => void;
  }>({ move: () => {}, apply: () => {}, close: () => {} });

  const notesCacheRef = useRef<WikiSuggestion[]>([]);
  const tagsCacheRef = useRef<string[]>([]);
  const fetchKeyRef = useRef("");
  const recomputeRef = useRef<() => void>(() => {});

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({ html: false, tightLists: true }),
      WikilinkDecorator,
      ...(callbacksRef.current?.renderEmbed
        ? [
            Embed.configure({
              renderEmbed: (target: string) =>
                callbacksRef.current?.renderEmbed?.(target) ?? null,
            }),
          ]
        : []),
    ],
    editorProps: {
      handleKeyDown(_view, event) {
        const current = suggestRef.current;
        if (!current || current.items.length === 0) {
          return false;
        }
        switch (event.key) {
          case "ArrowDown":
            actionsRef.current.move(1);
            return true;
          case "ArrowUp":
            actionsRef.current.move(-1);
            return true;
          case "Enter":
          case "Tab":
            actionsRef.current.apply();
            return true;
          case "Escape":
            actionsRef.current.close();
            return true;
          default:
            return false;
        }
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChangeRef.current(readMarkdown(instance));
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    // Don't clobber the document (and reset the selection) while the user is
    // actively editing; only sync external/programmatic value changes.
    if (editor.isFocused) {
      return;
    }
    if (value !== readMarkdown(editor)) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  // Prefetch suggestion sources so the first trigger has data.
  useEffect(() => {
    const callbacks = callbacksRef.current;
    void callbacks?.listNotes?.().then((notes) => {
      notesCacheRef.current = notes;
    });
    void callbacks?.listTags?.().then((tags) => {
      tagsCacheRef.current = tags;
    });
  }, []);

  const computeSuggest = useCallback(() => {
    if (!editor || !containerRef.current) {
      setSuggest(null);
      return;
    }
    const selection = editor.state.selection;
    if (!selection.empty) {
      setSuggest(null);
      return;
    }
    const cursor = selection.from;
    const blockStart = selection.$from.start();
    const textBefore = editor.state.doc.textBetween(blockStart, cursor, "\n", "\ufffc");

    const wikilink = /(!?)\[\[([^\]\n]*)$/.exec(textBefore);
    const tag = /(?:^|\s)#([\p{L}\p{N}/_-]*)$/u.exec(textBefore);

    let kind: SuggestKind;
    let embed = false;
    let query: string;
    let from: number;
    if (wikilink) {
      kind = "wikilink";
      embed = wikilink[1] === "!";
      query = wikilink[2];
      from = cursor - wikilink[0].length;
    } else if (tag) {
      kind = "tag";
      query = tag[1];
      from = cursor - tag[1].length - 1;
    } else {
      setSuggest(null);
      return;
    }

    // On a fresh trigger, refresh the cache in the background then recompute.
    const fetchKey = `${kind}:${from}`;
    if (fetchKeyRef.current !== fetchKey) {
      fetchKeyRef.current = fetchKey;
      const callbacks = callbacksRef.current;
      const refresh =
        kind === "wikilink"
          ? callbacks?.listNotes?.().then((notes) => {
              notesCacheRef.current = notes;
            })
          : callbacks?.listTags?.().then((tags) => {
              tagsCacheRef.current = tags;
            });
      void refresh?.then(() => recomputeRef.current());
    }

    const needle = query.toLowerCase();
    const items =
      kind === "wikilink"
        ? notesCacheRef.current
            .filter((note) => note.title.toLowerCase().includes(needle))
            .slice(0, 8)
            .map((note) => note.title)
        : tagsCacheRef.current.filter((name) => name.toLowerCase().includes(needle)).slice(0, 8);

    if (items.length === 0) {
      setSuggest(null);
      return;
    }

    const coords = editor.view.coordsAtPos(cursor);
    const rect = containerRef.current.getBoundingClientRect();
    setSuggest({
      kind,
      embed,
      from,
      to: cursor,
      items,
      index: 0,
      left: coords.left - rect.left,
      top: coords.bottom - rect.top + 4,
    });
  }, [editor]);

  recomputeRef.current = computeSuggest;

  useEffect(() => {
    if (!editor) {
      return;
    }
    const handler = () => computeSuggest();
    editor.on("selectionUpdate", handler);
    editor.on("update", handler);
    return () => {
      editor.off("selectionUpdate", handler);
      editor.off("update", handler);
    };
  }, [editor, computeSuggest]);

  const applySuggest = useCallback(
    (pickIndex?: number) => {
      const current = suggestRef.current;
      if (!editor || !current) {
        return;
      }
      const item = current.items[pickIndex ?? current.index];
      if (item === undefined) {
        return;
      }
      const insert =
        current.kind === "wikilink"
          ? current.embed
            ? `![[${item}]]`
            : `[[${item}]]`
          : `#${item} `;
      editor.chain().focus().insertContentAt({ from: current.from, to: current.to }, insert).run();
      setSuggest(null);
      fetchKeyRef.current = "";
    },
    [editor],
  );

  const moveSuggest = useCallback((delta: number) => {
    setSuggest((prev) =>
      prev ? { ...prev, index: (prev.index + delta + prev.items.length) % prev.items.length } : prev,
    );
  }, []);

  const closeSuggest = useCallback(() => {
    setSuggest(null);
    fetchKeyRef.current = "";
  }, []);

  actionsRef.current = { move: moveSuggest, apply: () => applySuggest(), close: closeSuggest };

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!editor) {
        return;
      }
      const path = event.dataTransfer.getData(NOTES_PATH_MIME);
      if (!path) {
        return;
      }
      event.preventDefault();

      const name = noteNameFromPath(path);
      // Alt/Option held → insert a plain link; otherwise embed.
      const text = event.altKey ? `[[${name}]]` : `![[${name}]]`;

      // Resolve the document position from the drop coordinates.
      const coords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (coords == null) {
        editor.chain().focus().insertContent(text).run();
      } else {
        editor.chain().focus().insertContentAt(coords.pos, text).run();
      }
    },
    [editor],
  );

  const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest(".wikilink");
    if (!anchor) {
      return;
    }
    const name = anchor.getAttribute("data-wikilink");
    if (name && callbacksRef.current?.onOpenWikilink) {
      event.preventDefault();
      callbacksRef.current.onOpenWikilink(name);
    }
  }, []);

  return (
    <div className="rendered-editor" ref={containerRef}>
      <EditorToolbar editor={editor} disabled={toolbarDisabled} trailing={toolbarTrailing} />
      <div
        className="rendered-scroll"
        onClick={handleClick}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(NOTES_PATH_MIME)) {
            event.preventDefault();
          }
        }}
        onDrop={handleDrop}
      >
        <EditorContent editor={editor} className="tiptap-host" />
      </div>
      {suggest && (
        <SuggestionPopup
          items={suggest.items}
          activeIndex={suggest.index}
          left={suggest.left}
          top={suggest.top}
          onPick={(index) => applySuggest(index)}
        />
      )}
    </div>
  );
}
