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

/** The full public surface handed to a plugin's `activate`. */
export interface PluginContext {
  readonly manifest: PluginManifest;
  registerCommand: (command: PluginCommand) => Disposer;
  addStatusBarItem: (item: StatusBarItem) => Disposer;
  /** Overrides a CSS design token (e.g. "--accent"). Returns a disposer. */
  setThemeToken: (name: string, value: string) => Disposer;
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
  document: DocumentSignal;
  storage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  };
}
