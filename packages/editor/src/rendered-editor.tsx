import { buildContent, parseFrontmatter } from "@notes/web/src/lib/frontmatter";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Markdown } from "tiptap-markdown";
import { Embed } from "./embed-extension";
import { ImageNode } from "./image-node";
import { StyledTextMark } from "./styled-text-mark";
import { SuggestionPopup } from "./suggestion-popup";
import { droppedPathInsertion, NOTES_PATH_MIME } from "./types";
import { EditorToolbar } from "./toolbar";
import type {
  CursorRequest,
  EditorCallbacks,
  FocusRequest,
  ScrollRequest,
  WikiSuggestion,
} from "./types";
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
  cursorRequest?: CursorRequest;
  scrollRequest?: ScrollRequest;
  onCursorChange?: (position: number) => void;
  onScrollChange?: (ratio: number) => void;
  onFocus?: () => void;
  focusRequest?: FocusRequest;
}

/** WYSIWYG editor (TipTap/ProseMirror): toolbar, clickable wikilinks, and autocomplete. */
export function RenderedEditor({
  value,
  onChange,
  callbacks,
  toolbarTrailing,
  toolbarDisabled = false,
  cursorRequest,
  scrollRequest,
  onCursorChange,
  onScrollChange,
  onFocus,
  focusRequest,
}: RenderedEditorProps) {
  const currentParts = parseFrontmatter(value);
  const frontmatterRef = useRef(currentParts.props);
  frontmatterRef.current = currentParts.props;
  const renderedValue = currentParts.body;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const onCursorChangeRef = useRef(onCursorChange);
  const onScrollChangeRef = useRef(onScrollChange);
  const onFocusRef = useRef(onFocus);
  const suppressScrollRef = useRef(false);
  const didInitialValueSyncRef = useRef(false);
  const pendingCursorRestoreRef = useRef<{
    active: boolean;
    desiredPosition: number;
    attempts: number;
  }>({
    active: false,
    desiredPosition: 1,
    attempts: 0,
  });
  onCursorChangeRef.current = onCursorChange;
  onScrollChangeRef.current = onScrollChange;
  onFocusRef.current = onFocus;

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollHostRef = useRef<HTMLDivElement>(null);
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
    content: renderedValue,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      ImageNode,
      StyledTextMark,
      Markdown.configure({ html: true, tightLists: true, transformPastedText: true }),
      WikilinkDecorator,
      ...(callbacksRef.current?.renderEmbed
        ? [
            Embed.configure({
              renderEmbed: (target: string) => callbacksRef.current?.renderEmbed?.(target) ?? null,
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
      onChangeRef.current(buildContent(frontmatterRef.current, readMarkdown(instance)));
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    if (!didInitialValueSyncRef.current) {
      didInitialValueSyncRef.current = true;
      return;
    }
    // Don't clobber the document (and reset the selection) while the user is
    // actively editing; only sync external/programmatic value changes.
    if (editor.isFocused) {
      return;
    }
    if (renderedValue !== readMarkdown(editor)) {
      const handle = window.setTimeout(() => {
        if (!editor.isFocused && renderedValue !== readMarkdown(editor)) {
          editor
            .chain()
            .setMeta("addToHistory", false)
            .setContent(renderedValue, { emitUpdate: false })
            .run();
        }
      }, 0);
      return () => window.clearTimeout(handle);
    }
  }, [renderedValue, editor]);

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
    const cursorHandler = () => onCursorChangeRef.current?.(editor.state.selection.from);
    const focusHandler = () => onFocusRef.current?.();
    editor.on("selectionUpdate", handler);
    editor.on("selectionUpdate", cursorHandler);
    editor.on("update", handler);
    editor.on("focus", focusHandler);
    return () => {
      editor.off("selectionUpdate", handler);
      editor.off("selectionUpdate", cursorHandler);
      editor.off("update", handler);
      editor.off("focus", focusHandler);
    };
  }, [editor, computeSuggest]);

  useEffect(() => {
    if (!cursorRequest) {
      return;
    }
    pendingCursorRestoreRef.current = {
      active: true,
      desiredPosition: Math.max(1, cursorRequest.position),
      attempts: 0,
    };
  }, [cursorRequest?.token]);

  const tryRestorePendingCursor = useCallback(() => {
    if (!editor) {
      return;
    }
    const pending = pendingCursorRestoreRef.current;
    if (!pending.active) {
      return;
    }
    // Wait until the editor document reflects the external value before
    // restoring selection; this avoids restoring against the initial empty doc.
    const hydrated =
      renderedValue.length === 0 ||
      readMarkdown(editor) === renderedValue ||
      editor.state.doc.content.size > 1 ||
      pending.attempts > 4;
    if (!hydrated) {
      pending.attempts += 1;
      return;
    }
    const size = Math.max(1, editor.state.doc.content.size);
    const position = Math.max(1, Math.min(size, pending.desiredPosition));
    editor.commands.focus(position, { scrollIntoView: true });
    pendingCursorRestoreRef.current.active = false;
  }, [editor, renderedValue]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    tryRestorePendingCursor();
    const timer = window.setTimeout(() => tryRestorePendingCursor(), 0);
    return () => window.clearTimeout(timer);
  }, [editor, renderedValue, tryRestorePendingCursor]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const onUpdate = () => tryRestorePendingCursor();
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor, tryRestorePendingCursor]);

  useEffect(() => {
    const host = scrollHostRef.current;
    if (!host || !scrollRequest) {
      return;
    }
    const max = Math.max(0, host.scrollHeight - host.clientHeight);
    suppressScrollRef.current = true;
    host.scrollTop = max * Math.max(0, Math.min(1, scrollRequest.ratio));
    window.requestAnimationFrame(() => {
      suppressScrollRef.current = false;
    });
  }, [scrollRequest?.token]);

  useEffect(() => {
    if (!editor || !focusRequest) {
      return;
    }
    const pending = pendingCursorRestoreRef.current;
    if (pending.active) {
      const size = Math.max(1, editor.state.doc.content.size);
      const position = Math.max(1, Math.min(size, pending.desiredPosition));
      editor.commands.focus(position, { scrollIntoView: true });
      return;
    }
    editor.commands.focus();
  }, [editor, focusRequest?.token]);

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
      prev
        ? { ...prev, index: (prev.index + delta + prev.items.length) % prev.items.length }
        : prev,
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
      if (path) {
        event.preventDefault();
        const text = droppedPathInsertion(path, event.altKey);
        const coords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (coords == null) {
          editor.chain().focus().insertContent(text).run();
        } else {
          editor.chain().focus().insertContentAt(coords.pos, text).run();
        }
        return;
      }
      const file = event.dataTransfer.files[0];
      const onImportFile = callbacksRef.current?.onImportFile;
      if (!file || !onImportFile) {
        return;
      }
      event.preventDefault();
      void onImportFile(file).then((insert) => {
        if (!insert) {
          return;
        }
        const coords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (coords == null) {
          editor.chain().focus().insertContent(insert).run();
        } else {
          editor.chain().focus().insertContentAt(coords.pos, insert).run();
        }
      });
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

  const handlePaste = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      if (!editor) {
        return;
      }
      const file = Array.from(event.clipboardData.items)
        .find((item) => item.kind === "file")
        ?.getAsFile();
      const onImportFile = callbacksRef.current?.onImportFile;
      if (!file || !onImportFile) {
        return;
      }
      event.preventDefault();
      void onImportFile(file).then((insert) => {
        if (!insert) {
          return;
        }
        editor.chain().focus().insertContent(insert).run();
      });
    },
    [editor],
  );

  return (
    <div className="rendered-editor" ref={containerRef}>
      <EditorToolbar editor={editor} disabled={toolbarDisabled} trailing={toolbarTrailing} />
      <div
        ref={scrollHostRef}
        className="rendered-scroll"
        onScroll={() => {
          const host = scrollHostRef.current;
          if (!host || suppressScrollRef.current) {
            return;
          }
          const max = Math.max(0, host.scrollHeight - host.clientHeight);
          const ratio = max === 0 ? 0 : host.scrollTop / max;
          onScrollChangeRef.current?.(ratio);
        }}
        onClick={handleClick}
        onPaste={handlePaste}
        onDragOver={(event) => {
          if (
            event.dataTransfer.types.includes(NOTES_PATH_MIME) ||
            event.dataTransfer.files.length > 0
          ) {
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
