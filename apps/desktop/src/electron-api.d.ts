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
