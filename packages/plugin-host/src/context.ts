import type { NoteTypeProvider } from "@notes/core";
import type { PluginManifest } from "./manifest";

export type Disposer = () => void;

export interface ActiveDocument {
  path: string;
  content: string;
  /** Frontmatter/extension-derived note type, e.g. "markdown" | "table" | "canvas" | "board". */
  type: string;
}

export interface PluginCommand {
  id: string;
  label: string;
  run: () => void;
  /** Optional default hotkey combo, e.g. "Mod+Shift+W". */
  defaultHotkey?: string;
}

/**
 * A status-bar contribution. `mount` receives a host-owned element and may
 * return a disposer; the manager also removes the element on teardown, so
 * plugins get clean unregistration for free.
 */
export interface StatusBarItem {
  id: string;
  mount: (element: HTMLElement) => Disposer | void;
}

export interface DocumentSignal {
  get: () => ActiveDocument | null;
  subscribe: (listener: (document: ActiveDocument | null) => void) => Disposer;
}

export interface PluginSettings {
  get: <T>(key: string, fallback: T) => T;
  set: (key: string, value: unknown) => void;
}

/** Props passed to a plugin file-type renderer. */
export interface FileViewProps {
  path: string;
  content: string;
  /** Call to request a save with updated content (for editable plugin views). */
  onChange?: (content: string) => void;
}

/**
 * Registers a plugin as the renderer for one or more file extensions.
 *
 * `mountEditor` / `mountEmbed` receive a stable host `HTMLElement` and the
 * current file props. They are called (and the element cleared) whenever the
 * content or path changes. Return a disposer for any subscriptions or timers
 * set up during mount; the disposer is automatically called before the next
 * remount and on plugin disable.
 */
export interface FileTypeHandler {
  /** Lowercase file extensions this handler claims, e.g. `[".json"]`. */
  extensions: string[];
  /** Short display label shown in toolbars / embeds, e.g. `"JSON"`. */
  label: string;
  /**
   * Whether the right-panel Properties section should be offered for files of
   * this type. Set to `false` when the format does not support YAML frontmatter
   * (e.g. binary files, JSON, CSV).
   */
  supportsFrontmatter: boolean;
  /**
   * Mounts the full editor/viewer for this file type into `element`.
   * The element is pre-cleared before each call.
   */
  mountEditor: (element: HTMLElement, props: FileViewProps) => Disposer | void;
  /**
   * Mounts a compact inline embed into `element` (used inside `![[...]]`
   * transclusions). Falls back to `mountEditor` when omitted.
   */
  mountEmbed?: (element: HTMLElement, props: FileViewProps) => Disposer | void;
}

/** The full public surface handed to a plugin's `activate`. */
export interface PluginContext {
  readonly manifest: PluginManifest;
  registerCommand: (command: PluginCommand) => Disposer;
  addStatusBarItem: (item: StatusBarItem) => Disposer;
  /** Overrides a CSS design token (e.g. "--accent"). Returns a disposer. */
  setThemeToken: (name: string, value: string) => Disposer;
  /**
   * Registers a file-type renderer for one or more extensions. The handler
   * takes over rendering in both the full editor pane and inline embeds.
   * Returns a disposer that unregisters the handler.
   */
  registerFileHandler: (handler: FileTypeHandler) => Disposer;
  /**
   * Registers a note-type renderer with full UI view capabilities (component,
   * toolbar items, context menu, mode restrictions, scroll sync, etc.).
   * Returns a disposer that unregisters the view when the plugin is disabled.
   */
  registerNoteView: (descriptor: NoteTypeProvider) => Disposer;
  readonly document: DocumentSignal;
  readonly settings: PluginSettings;
}

export interface NotesPlugin {
  manifest: PluginManifest;
  activate: (context: PluginContext) => void | Promise<void>;
  deactivate?: () => void;
}

/** Host services the manager binds each plugin's context to. */
export interface PluginHost {
  registerCommand: (command: PluginCommand) => Disposer;
  addStatusBarItem: (item: StatusBarItem) => Disposer;
  setThemeToken: (name: string, value: string) => Disposer;
  registerFileHandler: (handler: FileTypeHandler) => Disposer;
  registerNoteView: (descriptor: NoteTypeProvider) => Disposer;
  document: DocumentSignal;
  storage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  };
}
