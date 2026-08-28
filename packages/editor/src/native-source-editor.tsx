import { useEditorCallbacks } from "@notes/web/src/state/use-editor-callbacks";
import type { ContextMenuEntry } from "@notes/ui";
import {
  ClipboardEventHandler,
  DragEventHandler,
  SyntheticEvent,
  EventHandler,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { droppedPathInsertion, NOTES_PATH_MIME, RendererProps } from "./types";
import { useSourcePaneSync } from "./pane-sync-context";

export function NativeSourceEditor({ value, onChange, onRegisterContextMenu }: RendererProps) {
  const {
    scrollRequest,
    onScrollChange,
    focusRequest,
    onFocus,
    cursorRequest,
    onCursorChange,
    isReadOnly,
    isStandalone = false,
  } = useSourcePaneSync() ?? {};
  const { callbacks, promptDialog } = useEditorCallbacks(isStandalone);
  const effectiveOnChange = isReadOnly ? () => {} : onChange;

  const viewRef = useRef<HTMLTextAreaElement | null>(null);
  const suppressScrollRef = useRef(false);

  const handleDragover: DragEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      if (callbacks?.disableFileDrop) {
        return false;
      }
      if (
        event.dataTransfer?.types.includes(NOTES_PATH_MIME) ||
        (event.dataTransfer?.files.length ?? 0) > 0
      ) {
        event.preventDefault();
      }
      return false;
    },
    [callbacks],
  );

  const insertAt = useCallback(
    (start: number, end: number, element: HTMLTextAreaElement, value: string) => {
      element.setRangeText(value, start, end);
      const inputEvent = new Event("input", { bubbles: true });
      element.dispatchEvent(inputEvent);
    },
    [],
  );

  const handleInsertFile = useCallback(
    (file: File | undefined, event: SyntheticEvent<HTMLTextAreaElement>) => {
      const onImportFile = callbacks?.onImportFile;
      if (!file || !onImportFile) {
        return false;
      }
      event.preventDefault();
      void onImportFile(file).then((insert) => {
        if (!insert) {
          return;
        }
        const textareaElement = event.target as HTMLTextAreaElement;
        const [start, end] = [textareaElement.selectionStart, textareaElement.selectionEnd];
        insertAt(start, end, textareaElement, insert);
      });
      return true;
    },
    [callbacks?.onImportFile, insertAt],
  );

  const handleDrop: DragEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      if (callbacks?.disableFileDrop) {
        return false;
      }
      const textareaElement = event.target as HTMLTextAreaElement;
      const [start, end] = [textareaElement.selectionStart, textareaElement.selectionEnd];
      const path = event.dataTransfer?.getData(NOTES_PATH_MIME);
      if (path) {
        event.preventDefault();
        const text = droppedPathInsertion(path, event.altKey);
        insertAt(start, end, textareaElement, text);
        return true;
      }
      const file = event.dataTransfer?.files?.[0] ?? undefined;
      return handleInsertFile(file, event);
    },
    [callbacks?.disableFileDrop, handleInsertFile, insertAt],
  );

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      if (callbacks?.disableFileDrop) {
        return false;
      }
      const file =
        Array.from(event.clipboardData?.items ?? [])
          .find((item) => item.kind === "file")
          ?.getAsFile() ?? undefined;
      return handleInsertFile(file, event);
    },
    [callbacks?.disableFileDrop, handleInsertFile],
  );

  const handleSelectionChange: EventHandler<SyntheticEvent<HTMLTextAreaElement>> = useCallback(
    (event) => {
      const textarea = event.target as HTMLTextAreaElement;
      onCursorChange?.(textarea.selectionStart);
    },
    [onCursorChange],
  );

  const handleScroll = useCallback(() => {
    const view = viewRef.current;
    if (!view || suppressScrollRef.current) {
      return;
    }
    const max = Math.max(0, view.scrollHeight - view.clientHeight);
    const ratio = max === 0 ? 0 : view.scrollTop / max;
    onScrollChange?.(ratio);
  }, [onScrollChange]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !scrollRequest) {
      return;
    }
    const max = Math.max(0, view.scrollHeight - view.clientHeight);
    suppressScrollRef.current = true;
    view.scrollTop = max * Math.max(0, Math.min(1, scrollRequest.ratio));
    window.requestAnimationFrame(() => {
      suppressScrollRef.current = false;
    });
  }, [scrollRequest, scrollRequest?.token]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !focusRequest) {
      return;
    }
    view.focus();
  }, [focusRequest, focusRequest?.token]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !cursorRequest) {
      return;
    }
    const desiredPosition = Math.max(0, cursorRequest.position);
    const anchor = Math.max(0, Math.min(view.value.length, desiredPosition));
    view.setSelectionRange(anchor, anchor);
  }, [cursorRequest, cursorRequest?.token]);

  // Register context menu builder so the parent NoteEditor can show
  // "Copy to New Note" / "Move to New Note" when the user right-clicks a
  // non-empty selection inside the source pane.
  useEffect(() => {
    if (!onRegisterContextMenu) return;
    onRegisterContextMenu((target) => {
      const textarea = viewRef.current;
      if (!textarea) return null;
      const { selectionStart, selectionEnd } = textarea;
      if (selectionStart === selectionEnd) return null;
      const selectedText = textarea.value.slice(selectionStart, selectionEnd);
      if (!selectedText.trim()) return null;
      // Only activate for right-clicks inside the source column.
      if (target && !target.closest(".editor-column--split")) return null;
      const start = selectionStart;
      const end = selectionEnd;
      const items: ContextMenuEntry[] = [
        {
          label: "Copy to New Note",
          run: () => {
            void callbacks?.extractToNewNote?.(selectedText, "copy");
          },
        },
        {
          label: "Move to New Note",
          run: () => {
            void (async () => {
              const notePath = await callbacks?.extractToNewNote?.(selectedText, "move");
              if (notePath && viewRef.current) {
                const noteName =
                  notePath.replace(/\.md$/i, "").split("/").pop() ?? notePath;
                viewRef.current.setRangeText(`[[${noteName}]]`, start, end, "end");
                const inputEvent = new Event("input", { bubbles: true });
                viewRef.current.dispatchEvent(inputEvent);
              }
            })();
          },
        },
      ];
      return items;
    });
    return () => onRegisterContextMenu(null);
  }, [onRegisterContextMenu, callbacks]);

  return (
    <>
      <textarea
        ref={viewRef}
        className="source-editor"
        spellCheck="false"
        value={value}
        onChange={(event) => effectiveOnChange(event.target.value)}
        onDragOver={handleDragover}
        onDrop={handleDrop}
        onPaste={handlePaste}
        onFocus={onFocus}
        onSelect={handleSelectionChange}
        onScroll={handleScroll}
      />
      {promptDialog}
    </>
  );
}
