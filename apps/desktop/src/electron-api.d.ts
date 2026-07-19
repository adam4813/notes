/** Type declarations for the Electron IPC bridge exposed via contextBridge. */

interface ElectronAPI {
  /** Current OS platform (e.g. "win32", "darwin", "linux"). */
  readonly platform: string;

  /** Minimise the native window. */
  minimize(): void;
  /** Toggle maximise / restore the native window. */
  maximize(): void;
  /** Close the native window. */
  close(): void;
  /** Returns whether the window is currently maximised. */
  isMaximized(): Promise<boolean>;
  /**
   * Register a callback that fires when the window maximise state changes.
   * Returns a disposer function.
   */
  onMaximizeChange(cb: (isMaximized: boolean) => void): () => void;
  /** Returns the application version string from package.json. */
  getVersion(): Promise<string>;

  /** Returns the currently configured Tome path (null before first launch). */
  getTomePath(): Promise<string | null>;
  /** Opens the folder picker to choose a new Tome path; returns the chosen path or null. */
  chooseTomePath(): Promise<string | null>;
  /** Reveals a Tome-relative path in the native file explorer. */
  revealPath(relativePath: string): Promise<boolean>;
  /** Reveals a file in the native explorer, resolved against an explicit Tome path. */
  revealPathInTome(tomePath: string, relativePath: string): Promise<boolean>;

  /**
   * Opens a native file-open dialog restricted to .md files.
   * Returns the chosen file's absolute path and display name, or null if cancelled.
   */
  openFileDialog(): Promise<{ absPath: string; name: string } | null>;
  /**
   * Reads the full text content of an arbitrary file by absolute path.
   * Used for standalone (non-Tome) file tabs in the desktop app.
   */
  readStandaloneFile(absPath: string): Promise<string>;
  /**
   * Writes text content to an arbitrary file by absolute path.
   * Used for standalone (non-Tome) file tabs in the desktop app.
   */
  writeStandaloneFile(absPath: string, content: string): Promise<void>;
  /**
   * Register a callback that fires whenever the OS asks the app to open a file
   * (e.g. double-click in Explorer / Finder, or "Open with…").
   * Returns a disposer function.
   */
  onOpenWithFile(cb: (absPath: string) => void): () => void;

  /** Register a callback for when an update is available. Returns a disposer. */
  onUpdateAvailable(cb: (info: unknown) => void): () => void;
  /** Register a callback for download progress. Returns a disposer. */
  onUpdateProgress(cb: (progress: unknown) => void): () => void;
  /** Register a callback for when an update has been downloaded. Returns a disposer. */
  onUpdateDownloaded(cb: () => void): () => void;
  /** Quit and install the downloaded update. */
  installUpdate(): void;
}

interface Window {
  /** Defined when running inside the Electron shell; absent in the browser. */
  electronAPI?: ElectronAPI;
}
