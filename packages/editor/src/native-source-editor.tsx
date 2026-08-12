import { useEditorCallbacks } from "@notes/web/src/state/use-editor-callbacks";
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

export function NativeSourceEditor({ value, onChange }: RendererProps) {
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
  const callbacks = useEditorCallbacks(isStandalone);
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

  return (
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
  );
}
