import { MARKDOWN_NOTE_TYPE_ID } from "@notes/core";
import {
  DEFAULT_MARKDOWN_VIEW_STATE,
  type EditorMode,
  MarkdownEditor,
  type MarkdownViewState,
  getNoteContextMenuBuilder,
  NoteToolbar,
} from "@notes/editor";
import { CANVAS_NOTE_TYPE_ID } from "@notes/note-canvas";
import type { FileTypeHandler } from "@notes/plugin-host";
import {
  ContextMenu,
  ContextMenuEntry,
  type NoteViewContextMenuBuilder,
  useContextMenu,
} from "@notes/ui";
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { queueWrite } from "../api/offline-queue";
import { connectTomeChanges } from "../api/ws";
import { frontmatterType } from "../lib/frontmatter";
import { isImagePath } from "../lib/images";
import { useAppServices } from "../state/app-services";
import { useToasts } from "../state/toast";
import { ModeToggle, SaveState } from "./mode-toggle";

function basename(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
}

function getExtension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot !== -1 ? path.slice(dot).toLowerCase() : "";
}

/** DOM-bridged component that mounts a plugin file-type renderer into a div. */
function PluginFileView({
  handler,
  path,
  content,
  onChange,
}: {
  handler: FileTypeHandler;
  path: string;
  content: string;
  onChange?: (content: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const disposeRef = useRef<() => void>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    disposeRef.current?.();
    disposeRef.current = undefined;
    el.innerHTML = "";
    const result = handler.mountEditor(el, { path, content, onChange });
    if (typeof result === "function") disposeRef.current = result;
    return () => {
      disposeRef.current?.();
      disposeRef.current = undefined;
    };
  }, [handler, path, content, onChange]);

  return <div ref={ref} className="rendered-scroll" />;
}

interface PersistedEditorSession {
  mode: EditorMode;
  viewState: MarkdownViewState;
}

const markdownSessionByPath = new Map<string, PersistedEditorSession>();

function editorStateKey(path: string): string {
  return path.replaceAll("\\", "/").toLowerCase();
}

export function NoteEditor({
  path,
  defaultMode = "rendered",
  disableModeToggle,
  readFn,
  writeFn,
  isStandalone = false,
}: {
  path: string;
  defaultMode?: EditorMode;
  disableModeToggle?: boolean;
  /** Override the default `api.read` for this tab (used by standalone files). */
  readFn?: () => Promise<string>;
  /** Override the default `api.write` for this tab (used by standalone files). */
  writeFn?: (content: string) => Promise<void>;
  /** When true, disables file drop/paste and frontmatter type detection. */
  isStandalone?: boolean;
}) {
  const { markModified, setActiveDocument, fileHandlers, noteViewRegistry } = useAppServices();
  const { notify } = useToasts();
  const stateKey = editorStateKey(path);
  const initialSession = markdownSessionByPath.get(stateKey) ?? {
    mode: defaultMode,
    viewState: { ...DEFAULT_MARKDOWN_VIEW_STATE },
  };
  const [markdownViewState, setMarkdownViewState] = useState<MarkdownViewState>(
    initialSession.viewState,
  );
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<EditorMode>(initialSession.mode);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [splitScrollSync, setSplitScrollSync] = useState(initialSession.viewState.splitScrollSync);
  const ctxMenu = useContextMenu<HTMLElement | null>();
  // Note-view components register a builder here to supply content-specific
  // context menu items (e.g. board cards register Delete / Duplicate).
  const [noteViewCtxBuilder, setNoteViewCtxBuilder] = useState<NoteViewContextMenuBuilder | null>(
    null,
  );
  const regionRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const contentRef = useRef("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastWriteAtRef = useRef(0);
  const isImage = isImagePath(path);

  const persistSession = useCallback(
    (nextMode: EditorMode, nextViewState: MarkdownViewState) => {
      markdownSessionByPath.set(stateKey, { mode: nextMode, viewState: nextViewState });
    },
    [stateKey],
  );

  useEffect(() => {
    persistSession(mode, markdownViewState);
  }, [mode, markdownViewState, persistSession]);

  // Flush any unsaved edit when the component unmounts (tab switch / close).
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      if (!isImage && dirtyRef.current) {
        if (writeFn) {
          void writeFn(contentRef.current).catch(() => undefined);
        } else {
          void api.write(path, contentRef.current).catch(() => undefined);
        }
      }
    };
  }, [isImage, path, writeFn]); // empty deps: runs only on unmount

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveState("loading");
    if (isImage) {
      setContent("");
      contentRef.current = "";
      dirtyRef.current = false;
      setSaveState("saved");
      return () => {
        cancelled = true;
      };
    }
    const doRead = readFn ? readFn() : api.read(path).then((result) => result.content);
    doRead
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          contentRef.current = text;
          dirtyRef.current = false;
          setSaveState("saved");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSaveState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, isImage, readFn]);

  const save = useCallback(
    async (value: string) => {
      setSaveState("saving");
      try {
        if (writeFn) {
          await writeFn(value);
        } else {
          await api.write(path, value);
        }
        lastWriteAtRef.current = Date.now();
        dirtyRef.current = false;
        setSaveState("saved");
      } catch {
        if (writeFn) {
          // Standalone file — no offline queue; surface the error.
          setSaveState("error");
          notify("Couldn't save file.", { kind: "error" });
        } else {
          // Never lose the edit: buffer it locally to sync when back online.
          queueWrite({ path, content: value });
          dirtyRef.current = false;
          setSaveState("offline");
          notify("Offline — your changes are saved locally and will sync automatically.", {
            kind: "info",
          });
        }
      }
    },
    [path, notify, writeFn],
  );

  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      contentRef.current = value;
      dirtyRef.current = true;
      setSaveState("unsaved");
      markModified(path);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      saveTimer.current = setTimeout(() => void save(value), 600);
    },
    [save, markModified, path],
  );

  // Reload on external changes when there are no unsaved local edits.
  useEffect(() => {
    return connectTomeChanges((change) => {
      if (change.path !== path) {
        return;
      }
      if (isImage) {
        return;
      }
      // Ignore the file-watcher echo of our own atomic write, which would
      // otherwise reload and reset the cursor while the user keeps editing.
      if (Date.now() - lastWriteAtRef.current < 1500) {
        return;
      }
      if (dirtyRef.current) {
        setSaveState("external");
        return;
      }
      void api.read(path).then((result) => {
        if (result.content !== contentRef.current) {
          setContent(result.content);
          contentRef.current = result.content;
        }
      });
    });
  }, [path, isImage]);

  const pluginHandler = fileHandlers.find((h) => h.extensions.includes(getExtension(path)));
  const isCanvas = !pluginHandler && path.toLowerCase().endsWith(".canvas");
  const frontType = isCanvas
    ? CANVAS_NOTE_TYPE_ID
    : (frontmatterType(content) ?? MARKDOWN_NOTE_TYPE_ID);
  const activeDescriptor = !pluginHandler && !isImage ? noteViewRegistry.get(frontType) : undefined;
  const descriptorSourceProtected = activeDescriptor?.sourceProtected ?? false;
  const descriptorSupportedModes =
    activeDescriptor?.supportedModes ?? (["edit", "split", "rendered"] as EditorMode[]);
  const descriptorSupportsScrollSync = activeDescriptor?.supportsScrollSync ?? false;
  const canToggleMode = !isImage && !disableModeToggle && descriptorSupportedModes.length > 1;

  // Publish the active document to plugins (word count, etc.).
  useEffect(() => {
    if (saveState === "loading") {
      return;
    }
    const ext = getExtension(path);
    const pluginHandler = fileHandlers.find((h) => h.extensions.includes(ext));
    const type = isStandalone
      ? "markdown"
      : pluginHandler
        ? ext.slice(1) // e.g. "json"
        : isImage
          ? "image"
          : frontType;
    setActiveDocument({ path, content, type });
    return () => setActiveDocument(null);
  }, [path, content, saveState, setActiveDocument, isImage, fileHandlers, isStandalone, frontType]);

  // When the active note type changes, seed the context menu builder from the
  // descriptor (if any). Component-level registrations (via onRegisterContextMenu)
  // will override this for richer per-instance menus.
  useEffect(() => {
    const builder = activeDescriptor ? getNoteContextMenuBuilder(activeDescriptor) : undefined;
    setNoteViewCtxBuilder(() => builder ?? null);
  }, [activeDescriptor]);

  const runEditCommand = useCallback(
    (command: string, target: HTMLElement | null) => {
      target?.focus();
      document.execCommand(command);
      ctxMenu.close();
    },
    [ctxMenu],
  );

  const contextMenuItems = useMemo(() => {
    const target = ctxMenu.menu?.data ?? null;

    // FIXME: noteViewCtxBuilder is an array
    if (typeof noteViewCtxBuilder === "function") {
      const custom = noteViewCtxBuilder?.(target);
      if (custom) return custom;
    }

    // Default: generic text-editing commands.
    const items: ContextMenuEntry[] = [];
    items.push(
      { label: "Undo", run: () => runEditCommand("undo", target) },
      { label: "Redo", run: () => runEditCommand("redo", target) },
      { separator: true },
      { label: "Cut", run: () => runEditCommand("cut", target) },
      { label: "Copy", run: () => runEditCommand("copy", target) },
      { label: "Paste", run: () => runEditCommand("paste", target) },
      { label: "Select All", run: () => runEditCommand("selectAll", target) },
    );
    return items;
  }, [ctxMenu.menu?.data, noteViewCtxBuilder, runEditCommand]);

  if (saveState === "loading") {
    return <div className="note-loading">Loading…</div>;
  }

  return (
    <div className="note-editor">
      <div
        className="note-editor-region"
        ref={regionRef}
        onContextMenu={(event: MouseEvent<HTMLDivElement>) => {
          const target = event.target as HTMLElement | null;
          if (!target || target.closest(".context-menu")) {
            return;
          }
          if (typeof noteViewCtxBuilder === "function") {
            const custom = noteViewCtxBuilder?.(target);
            // If the note view's builder returns [] (empty), suppress the menu entirely.
            if (custom !== undefined && custom !== null && custom.length === 0) return;
          }
          event.preventDefault();
          ctxMenu.open({ x: event.clientX, y: event.clientY }, target);
        }}
      >
        {canToggleMode && (
          <ModeToggle
            onChangeMode={(nextMode) => {
              setMode(nextMode);
              persistSession(nextMode, markdownViewState);
            }}
            mode={mode}
            splitScrollSync={splitScrollSync}
            onToggleSyncScroll={() =>
              setSplitScrollSync((prev) => {
                const next = !prev;
                setMarkdownViewState((prevState) => {
                  const nextState = {
                    ...prevState,
                    splitScrollSync: next,
                  };
                  persistSession(mode, nextState);
                  return nextState;
                });
                return next;
              })
            }
            saveState={saveState}
            supportedModes={descriptorSupportedModes}
            supportsScrollSync={descriptorSupportsScrollSync}
          />
        )}
        {pluginHandler ? (
          <div className="plugin-note">
            <NoteToolbar
              label={pluginHandler.label}
              trailing={<span className="note-toolbar-path">{path}</span>}
            >
              <span className="note-type-badge">{pluginHandler.label}</span>
            </NoteToolbar>
            <PluginFileView
              handler={pluginHandler}
              path={path}
              content={content}
              onChange={handleChange}
            />
          </div>
        ) : isImage ? (
          <div className="image-note">
            <NoteToolbar label="Image" trailing={<span className="note-toolbar-path">{path}</span>}>
              <span className="note-type-badge">Image</span>
            </NoteToolbar>
            <div className="image-note-body">
              <img className="image-note-preview" src={api.fileRawUrl(path)} alt={basename(path)} />
            </div>
          </div>
        ) : (
          <MarkdownEditor
            mode={mode}
            path={path}
            value={content}
            onChange={handleChange}
            viewState={markdownViewState}
            syncSplitScroll={splitScrollSync}
            onViewStateChange={(patch) => {
              setMarkdownViewState((prevState) => {
                const nextState = { ...prevState, ...patch };
                persistSession(mode, nextState);
                return nextState;
              });
            }}
            isReadOnly={descriptorSourceProtected}
            disableToolbarInEdit
            isStandalone={isStandalone}
            setNoteViewCtxBuilder={setNoteViewCtxBuilder}
          />
        )}
      </div>

      {ctxMenu.menu && (
        <ContextMenu
          position={ctxMenu.menu.position}
          items={contextMenuItems}
          onClose={ctxMenu.close}
          menuRef={ctxMenu.menuRef}
        />
      )}
    </div>
  );
}
