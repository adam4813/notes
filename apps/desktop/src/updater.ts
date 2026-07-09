import type { BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

/**
 * Sets up electron-updater to check GitHub Releases for updates.
 * Skips in dev mode. Delays first check by 5 s to let the UI settle.
 */
export function setupAutoUpdater(win: BrowserWindow): void {
  if (process.env["ELECTRON_DEV"] === "1") {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    win.webContents.send("updater:available", info);
  });

  autoUpdater.on("download-progress", (progress) => {
    win.webContents.send("updater:progress", progress);
  });

  autoUpdater.on("update-downloaded", () => {
    win.webContents.send("updater:downloaded");
  });

  autoUpdater.on("error", (err) => {
    // Log silently — no update server configured is a normal state.
    console.log("[updater] Error:", err.message);
  });

  // Delay first check so the UI has time to fully load.
  setTimeout(() => {
    void autoUpdater.checkForUpdatesAndNotify().catch((err: unknown) => {
      console.log("[updater] Check failed (expected if no publish config):", err);
    });
  }, 5000);
}
