/**
 * Abstraction for a standalone (non-Tome) file that can be read and written.
 * Implementations may wrap the File System Access API (web) or Electron IPC (desktop).
 */
export interface StandaloneFileHandle {
  readonly name: string;
  read(): Promise<string>;
  write(content: string): Promise<void>;
}

/**
 * Module-level store for StandaloneFileHandle instances associated with
 * standalone (non-Tome) tabs. Keyed by the tab's `path` field.
 *
 * These handles are intentionally NOT persisted — standalone tabs disappear
 * after a page reload and must be reopened by the user.
 */
const handles = new Map<string, StandaloneFileHandle>();

export const STANDALONE_PATH_PREFIX = "standalone://";

/** Returns true when a tab path refers to a standalone (non-Tome) file. */
export function isStandalonePath(path: string): boolean {
  return path.startsWith(STANDALONE_PATH_PREFIX);
}

/** Generates a unique standalone tab path for a newly opened file. */
export function makeStandalonePath(): string {
  const id = globalThis.crypto.randomUUID();
  return `${STANDALONE_PATH_PREFIX}tab-${id}`;
}

export function registerStandaloneHandle(path: string, handle: StandaloneFileHandle): void {
  handles.set(path, handle);
}

export function getStandaloneHandle(path: string): StandaloneFileHandle | undefined {
  return handles.get(path);
}

export function removeStandaloneHandle(path: string): void {
  handles.delete(path);
}

/** Creates a StandaloneFileHandle backed by the File System Access API. */
export function makeFsaHandle(fsaHandle: FileSystemFileHandle): StandaloneFileHandle {
  return {
    name: fsaHandle.name,
    async read() {
      const file = await fsaHandle.getFile();
      return file.text();
    },
    async write(content: string) {
      const writable = await fsaHandle.createWritable();
      await writable.write(content);
      await writable.close();
    },
  };
}

/** Creates a StandaloneFileHandle backed by Electron IPC (desktop only). */
export function makeElectronHandle(absPath: string, name: string): StandaloneFileHandle {
  return {
    name,
    async read() {
      return window.electronAPI!.readStandaloneFile(absPath);
    },
    async write(content: string) {
      await window.electronAPI!.writeStandaloneFile(absPath, content);
    },
  };
}
