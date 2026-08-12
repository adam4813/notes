import { FindBar } from "@notes/web/src/components/find-bar";
import { buildContent, parseFrontmatter } from "@notes/web/src/lib/frontmatter";
import { useAppServices } from "@notes/web/src/state/app-services";
import { useEditorCallbacks } from "@notes/web/src/state/use-editor-callbacks";
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
} from "react";
import { Markdown } from "tiptap-markdown";
import { Embed } from "./embed-extension";
import { ImageNode } from "./image-node";
import { StyledTextMark } from "./styled-text-mark";
import { SuggestionPopup } from "./suggestion-popup";
import { droppedPathInsertion, NOTES_PATH_MIME, RendererProps } from "./types";
import { EditorToolbar } from "./toolbar";
import type { WikiSuggestion } from "./types";
import { useRenderedPaneSync } from "./pane-sync-context";
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

type RenderedWidthMode = "normal" | "wide";
type RenderedWidthOverride = RenderedWidthMode | "unset";

const RENDERED_WIDTH_FRONTMATTER_KEY = "__notes_rendered_width";

function parseRenderedWidthMode(value: string | null | undefined): RenderedWidthMode | undefined {
  return value === "normal" || value === "wide" ? value : undefined;
}

function readRenderedWidthOverride(content: string): RenderedWidthMode | undefined {
  const parsed = parseFrontmatter(content);
  const raw = parsed.props.find((prop) => prop.key === RENDERED_WIDTH_FRONTMATTER_KEY)?.value;
  return parseRenderedWidthMode(raw as string | null | undefined);
}

function applyRenderedWidthOverride(content: string, override: RenderedWidthOverride): string {
  const parsed = parseFrontmatter(content);
  const props = parsed.props.filter((prop) => prop.key !== RENDERED_WIDTH_FRONTMATTER_KEY);
  if (override === "normal" || override === "wide") {
    props.push({ key: RENDERED_WIDTH_FRONTMATTER_KEY, value: override });
  }
  return buildContent(props, parsed.body);
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

/** WYSIWYG editor (TipTap/ProseMirror): toolbar, clickable wikilinks, and autocomplete. */
export function RenderedEditor({
  value,
  onChange,
  toolbarDisabled = false,
}: Omit<RendererProps, "path"> & { toolbarDisabled?: boolean; path?: string }) {
  // Context wins over props; props are fallbacks for standalone usage.
  const {
    isStandalone = false,
    cursorRequest,
    scrollRequest,
    onCursorChange,
    onScrollChange,
    onFocus,
    focusRequest,
  } = useRenderedPaneSync() ?? {};
  const callbacks = useEditorCallbacks(isStandalone);
  const { settings } = useAppServices();
  const [findOpen, setFindOpen] = useState(false);
  const currentParts = parseFrontmatter(value);
  const renderedValue = currentParts.body;
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

  // Standalone files don't write frontmatter, so never read/show the width override.
  const renderedWidthOverride = readRenderedWidthOverride(value);
  const defaultRenderedWidth = parseRenderedWidthMode(settings.renderedWidthDefault) ?? "normal";
  const renderedWidth: RenderedWidthMode = renderedWidthOverride ?? defaultRenderedWidth;
  const selectedRenderedWidthOverride: RenderedWidthOverride = renderedWidthOverride ?? "unset";

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollHostRef = useRef<HTMLDivElement>(null);
  const [suggest, setSuggest] = useState<SuggestState | null>(null);

  const notesCacheRef = useRef<WikiSuggestion[]>([]);
  const tagsCacheRef = useRef<string[]>([]);
  const fetchKeyRef = useRef("");
  const recomputeRef = useRef<() => void>(() => {});

  const applySuggest = useCallback(
    (editor: Editor | null, pickIndex?: number) => {
      const current = suggest;
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
    [suggest],
  );

  const moveSuggest = useCallback(
    (delta: number) => {
      setSuggest((prev) =>
        prev
          ? { ...prev, index: (prev.index + delta + prev.items.length) % prev.items.length }
          : prev,
      );
    },
    [setSuggest],
  );

  const closeSuggest = useCallback(() => {
    setSuggest(null);
    fetchKeyRef.current = "";
  }, [setSuggest]);

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
      ...(callbacks?.renderEmbed
        ? [
            Embed.configure({
              renderEmbed: (target: string) => callbacks?.renderEmbed?.(target) ?? null,
            }),
          ]
        : []),
    ],
    editorProps: {
      handleKeyDown(_view, event) {
        const current = suggest;
        if (!current || current.items.length === 0) {
          return false;
        }
        switch (event.key) {
          case "ArrowDown":
            moveSuggest(1);
            return true;
          case "ArrowUp":
            moveSuggest(-1);
            return true;
          case "Enter":
          case "Tab":
            applySuggest(editor);
            return true;
          case "Escape":
            closeSuggest();
            return true;
          default:
            return false;
        }
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(buildContent(currentParts.props, readMarkdown(instance)));
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
    void callbacks?.listNotes?.().then((notes) => {
      notesCacheRef.current = notes;
    });
    void callbacks?.listTags?.().then((tags) => {
      tagsCacheRef.current = tags;
    });
  }, [callbacks]);

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
  }, [callbacks, editor]);

  // eslint-disable-next-line react-hooks/refs
  recomputeRef.current = computeSuggest;

  useEffect(() => {
    if (!editor) {
      return;
    }
    const handler = () => computeSuggest();
    const cursorHandler = () => onCursorChange?.(editor.state.selection.from);
    const focusHandler = () => onFocus?.();
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
  }, [editor, computeSuggest, onCursorChange, onFocus]);

  useEffect(() => {
    if (!cursorRequest) {
      return;
    }
    pendingCursorRestoreRef.current = {
      active: true,
      desiredPosition: Math.max(1, cursorRequest.position),
      attempts: 0,
    };
  }, [cursorRequest, cursorRequest?.token]);

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
  }, [scrollRequest, scrollRequest?.token]);

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
  }, [editor, focusRequest, focusRequest?.token]);

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!editor) {
        return;
      }
      if (callbacks?.disableFileDrop) {
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
      const onImportFile = callbacks?.onImportFile;
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
    [callbacks?.disableFileDrop, callbacks?.onImportFile, editor],
  );

  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const anchor = (event.target as HTMLElement).closest(".wikilink");
      if (!anchor) {
        return;
      }
      const name = anchor.getAttribute("data-wikilink");
      if (name && callbacks?.onOpenWikilink) {
        event.preventDefault();
        callbacks.onOpenWikilink(name);
      }
    },
    [callbacks],
  );

  const handlePaste = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      if (!editor) {
        return;
      }
      if (callbacks?.disableFileDrop) {
        return;
      }
      const file = Array.from(event.clipboardData.items)
        .find((item) => item.kind === "file")
        ?.getAsFile();
      const onImportFile = callbacks?.onImportFile;
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
    [callbacks?.disableFileDrop, callbacks?.onImportFile, editor],
  );

  return (
    <div className="editor-column editor-column--rendered">
      <div
        className={`rendered-editor ${renderedWidth ? `rendered-editor--render-width-${renderedWidth}` : ""}`}
        ref={containerRef}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
            event.preventDefault();
            setFindOpen(true);
          }
        }}
      >
        <EditorToolbar
          editor={editor}
          disabled={toolbarDisabled}
          trailing={
            <div className="editor-toolbar-meta">
              {!isStandalone && (
                <label className="editor-width-control">
                  <span className="editor-width-label">Width</span>
                  <select
                    className="editor-width-select"
                    aria-label="Rendered width override"
                    value={selectedRenderedWidthOverride}
                    onChange={(event) => {
                      const next = event.target.value as RenderedWidthOverride;
                      const nextContent = applyRenderedWidthOverride(value, next);
                      if (nextContent !== value) {
                        onChange(nextContent);
                      }
                    }}
                  >
                    <option value="unset">Unset (use default)</option>
                    <option value="normal">Normal</option>
                    <option value="wide">Wide</option>
                  </select>
                </label>
              )}
              <div className="editor-find-wrap">
                <button
                  className="editor-find-btn"
                  title="Find in note (Ctrl/Cmd+F)"
                  aria-label="Find in note"
                  aria-expanded={findOpen}
                  onClick={() => {
                    setFindOpen((open) => !open);
                  }}
                >
                  🔍 Find
                </button>
                {findOpen && (
                  <div className="editor-find-popout">
                    <FindBar
                      regionRef={scrollHostRef}
                      content={value}
                      onReplace={onChange}
                      onClose={() => setFindOpen(false)}
                    />
                  </div>
                )}
              </div>
            </div>
          }
        />
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
            onScrollChange?.(ratio);
          }}
          onClick={handleClick}
          onPaste={handlePaste}
          onDragOver={(event) => {
            if (
              !callbacks?.disableFileDrop &&
              (event.dataTransfer.types.includes(NOTES_PATH_MIME) ||
                event.dataTransfer.files.length > 0)
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
            onPick={(index) => applySuggest(editor, index)}
          />
        )}
      </div>
    </div>
  );
}
