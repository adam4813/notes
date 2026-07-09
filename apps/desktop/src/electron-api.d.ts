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
}

interface Window {
  /** Defined when running inside the Electron shell; absent in the browser. */
  electronAPI?: ElectronAPI;
}
