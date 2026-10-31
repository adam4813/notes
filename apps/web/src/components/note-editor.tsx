import {
  DEFAULT_MARKDOWN_VIEW_STATE,
  EDITOR_MODES,
  EditorToolbar,
  type EditorMode,
  type MarkdownViewState,
  MARKDOWN_NOTE_TYPE_ID,
  NativeSourceEditor,
  NoteToolbar,
  PaneSyncProvider,
  getNoteContextMenuBuilder,
  getNoteViewComponent,
  type RendererProps,
} from "@notes/editor";
import { CANVAS_NOTE_TYPE_ID } from "@notes/note-canvas";
import type { FileTypeHandler } from "@notes/plugin-host";
import {
  ContextMenuEntry,
  type ContextMenuContribution,
  type CustomContextMenuBuilder,
  useContextMenuController,
} from "@notes/ui";
import {
  type ComponentType,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "../api/client";
import { queueWrite } from "../api/offline-queue";
import { connectTomeChanges } from "../api/ws";
import { exportAsHtml } from "../lib/export-html";
import { frontmatterType } from "../lib/frontmatter";
import { copyImageToClipboard, isImagePath } from "../lib/images";
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

/**
 * Stable shell component that renders a dynamically-resolved note renderer.
 * Declared at module level so the linter does not consider it "created during render".
 */
function DynamicNoteRenderer({
  renderer: Renderer,
  ...props
}: RendererProps & { renderer: ComponentType<RendererProps> }) {
  return <Renderer {...props} />;
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
  const { markModified, setActiveDocument, fileHandlers, noteTypeRegistry, deletePath } =
    useAppServices();
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
  const contextMenu = useContextMenuController();
  const [customCtxBuilder, setCustomCtxBuilder] = useState<CustomContextMenuBuilder | null>(null);
  const [sourceCtxBuilder, setSourceCtxBuilder] = useState<CustomContextMenuBuilder | null>(null);
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

  const registerCustomCtxBuilder = useCallback((builder: CustomContextMenuBuilder | null) => {
    // setState dispatch is a function, so to store a function, we need to use the function syntax
    setCustomCtxBuilder(() => builder);
  }, []);

  const registerSourceCtxBuilder = useCallback((builder: CustomContextMenuBuilder | null) => {
    setSourceCtxBuilder(() => builder);
  }, []);

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
  const activeDescriptor = !pluginHandler && !isImage ? noteTypeRegistry.get(frontType) : undefined;
  const descriptorSourceProtected = activeDescriptor?.sourceProtected ?? false;
  const descriptorSupportedModes = activeDescriptor?.supportedModes ?? EDITOR_MODES;
  const descriptorSupportsScrollSync = activeDescriptor?.supportsScrollSync ?? false;
  const canToggleMode = !isImage && !disableModeToggle && descriptorSupportedModes.length > 1;

  // Resolved component for the active note type — passed to DynamicNoteRenderer.
  const noteRenderer = activeDescriptor ? getNoteViewComponent(activeDescriptor) : undefined;

  // Clamp the mode to what the descriptor allows.
  const effectiveMode = descriptorSupportedModes.includes(mode)
    ? mode
    : (descriptorSupportedModes[0] ?? "rendered");
  const showSource = effectiveMode === "edit" || effectiveMode === "split";
  const showRendered = effectiveMode === "rendered" || effectiveMode === "split";

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

  const handleExportHtml = useCallback(() => {
    const el = regionRef.current?.querySelector<HTMLElement>(".rendered-scroll");
    if (!el) return;
    const title = basename(path);
    void exportAsHtml(el, title).catch(() => {
      notify("Export failed.", { kind: "error" });
    });
  }, [path, notify]);

  // Descriptor-declared builder is the fallback; component-registered takes priority.
  const descriptorCtxBuilder = activeDescriptor
    ? (getNoteContextMenuBuilder(activeDescriptor) ?? null)
    : null;
  const ctxBuilder = customCtxBuilder ?? descriptorCtxBuilder;

  /** Normalize a builder's return value into a contribution (array ⇒ no basic actions). */
  const toContribution = useCallback(
    (
      result: ContextMenuEntry[] | ContextMenuContribution | null,
    ): ContextMenuContribution | null => {
      if (result === null || result === undefined) return null;
      if (Array.isArray(result)) return { items: result, includeBasicActions: false };
      return result;
    },
    [],
  );

  /** Try each registered builder in priority order; return the first contribution. */
  const resolveContribution = useCallback(
    (target: HTMLElement | null): ContextMenuContribution | null => {
      for (const builder of [ctxBuilder, sourceCtxBuilder]) {
        if (!builder) continue;
        const contribution = toContribution(builder(target));
        if (contribution) return contribution;
      }
      return null;
    },
    [ctxBuilder, sourceCtxBuilder, toContribution],
  );

  const runEditCommand = useCallback((command: string, target: HTMLElement | null) => {
    target?.focus();
    document.execCommand(command);
  }, []);

  /** Generic clipboard actions, shown whenever a view does not fully override them. */
  const basicEditActions = useCallback(
    (target: HTMLElement | null): ContextMenuEntry[] => [
      { label: "Undo", run: () => runEditCommand("undo", target) },
      { label: "Redo", run: () => runEditCommand("redo", target) },
      { separator: true },
      { label: "Cut", run: () => runEditCommand("cut", target) },
      { label: "Copy", run: () => runEditCommand("copy", target) },
      { label: "Paste", run: () => runEditCommand("paste", target) },
      { label: "Select All", run: () => runEditCommand("selectAll", target) },
    ],
    [runEditCommand],
  );

  /** Image-note actions: copy pixels, copy address, or delete the file. */
  const imageNoteActions = useCallback((): ContextMenuEntry[] => {
    const rawUrl = api.fileRawUrl(path);
    const address = new URL(rawUrl, window.location.origin).href;
    return [
      {
        label: "Copy Image",
        run: () => {
          void copyImageToClipboard(rawUrl).then((ok) => {
            if (ok) {
              notify("Image copied.", { kind: "info" });
            } else {
              void navigator.clipboard.writeText(address);
              notify("Couldn't copy the image — copied its address instead.", { kind: "info" });
            }
          });
        },
      },
      { label: "Copy Image Address", run: () => void navigator.clipboard.writeText(address) },
      { separator: true },
      { label: "Delete Image", danger: true, run: () => void deletePath(path) },
    ];
  }, [path, deletePath, notify]);

  /** Assemble the full menu for a right-click target. Always returns a usable menu. */
  const buildMenuItems = useCallback(
    (target: HTMLElement | null): ContextMenuEntry[] => {
      if (isImage) {
        return imageNoteActions();
      }
      const contribution = resolveContribution(target);
      if (!contribution) {
        return basicEditActions(target);
      }
      if (!contribution.includeBasicActions) {
        return contribution.items;
      }
      const items = [...contribution.items];
      if (items.length > 0) {
        items.push({ separator: true });
      }
      items.push(...basicEditActions(target));
      return items;
    },
    [isImage, imageNoteActions, resolveContribution, basicEditActions],
  );

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
          const items = buildMenuItems(target);
          if (items.length === 0) {
            return;
          }
          event.preventDefault();
          contextMenu.open({ x: event.clientX, y: event.clientY }, items);
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
            onExportHtml={showRendered && noteRenderer ? handleExportHtml : undefined}
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
          <PaneSyncProvider
            setMarkdownViewState={setMarkdownViewState}
            persistSession={persistSession}
            mode={mode}
            initialSession={initialSession}
            splitScrollSync={splitScrollSync}
            isReadOnly={descriptorSourceProtected}
            isStandalone={isStandalone}
          >
            <div className={`markdown-editor-shell markdown-editor-shell--${effectiveMode}`}>
              {effectiveMode === "edit" && <EditorToolbar editor={null} disabled />}
              <div className={`markdown-editor markdown-editor--${effectiveMode}`}>
                {showSource && (
                  <div className="editor-column editor-column--split">
                    <NativeSourceEditor
                      value={content}
                      onChange={handleChange}
                      path={path}
                      onRegisterContextMenu={registerSourceCtxBuilder}
                    />
                  </div>
                )}
                {showRendered && noteRenderer && (
                  <DynamicNoteRenderer
                    renderer={noteRenderer}
                    path={path}
                    value={content}
                    onChange={handleChange}
                    onRegisterContextMenu={registerCustomCtxBuilder}
                  />
                )}
                {showRendered && !noteRenderer && (
                  <div className="note-renderer-missing">
                    No renderer registered for &ldquo;{frontType}&rdquo;.
                  </div>
                )}
              </div>
            </div>
          </PaneSyncProvider>
        )}
      </div>
    </div>
  );
}
