import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { configStore } from "./config-store";
import { buildMenu } from "./menu";
import { setupAutoUpdater } from "./updater";

const DEV = process.env["ELECTRON_DEV"] === "1";
const WEB_DEV_URL = "http://localhost:5173";

/**
 * Returns the persisted tome path, or prompts the user to choose one on first launch.
 * Falls back to ~/Documents/Notes if the dialog is cancelled.
 */
async function ensureTomePath(): Promise<string> {
  const stored = configStore.get("tomePath");
  if (stored) return stored;

  const defaultPath = path.join(app.getPath("documents"), "Notes");
  const result = await dialog.showOpenDialog({
    title: "Choose your Notes folder",
    defaultPath,
    properties: ["openDirectory", "createDirectory"],
    buttonLabel: "Use This Folder",
  });

  const tomePath = result.canceled ? defaultPath : (result.filePaths[0] ?? defaultPath);
  await mkdir(tomePath, { recursive: true });
  configStore.set("tomePath", tomePath);
  return tomePath;
}

function setupWindowIpc(win: BrowserWindow): void {
  // Re-register safely when windows are recreated (macOS activate flow).
  ipcMain.removeHandler("window:isMaximized");
  ipcMain.removeHandler("app:version");
  ipcMain.removeHandler("tome:getPath");
  ipcMain.removeHandler("tome:choosePath");
  ipcMain.removeHandler("tome:revealPath");
  ipcMain.removeHandler("tome:revealPathInTome");

  ipcMain.on("window:minimize", () => win.minimize());
  ipcMain.on("window:maximize", () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  ipcMain.on("window:close", () => win.close());
  ipcMain.handle("window:isMaximized", () => win.isMaximized());
  ipcMain.handle("app:version", () => app.getVersion());

  win.on("maximize", () => win.webContents.send("window:maximizeChange", true));
  win.on("unmaximize", () => win.webContents.send("window:maximizeChange", false));

  // Tome path IPC
  ipcMain.handle("tome:getPath", () => configStore.get("tomePath"));
  ipcMain.handle("tome:revealPath", async (_event, relativePath: string) => {
    const tomePath = configStore.get("tomePath");
    if (!tomePath || typeof relativePath !== "string" || relativePath.trim().length === 0) {
      return false;
    }
    const absolute = path.resolve(tomePath, relativePath);
    const relative = path.relative(tomePath, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return false;
    }
    shell.showItemInFolder(absolute);
    return true;
  });
  ipcMain.handle(
    "tome:revealPathInTome",
    async (_event, payload: { tomePath?: string; relativePath?: string }) => {
      const tomePath = payload?.tomePath;
      const relativePath = payload?.relativePath;
      if (
        typeof tomePath !== "string" ||
        tomePath.trim().length === 0 ||
        typeof relativePath !== "string" ||
        relativePath.trim().length === 0
      ) {
        return false;
      }
      const normalizedTomePath = path.resolve(tomePath);
      const absolute = path.resolve(normalizedTomePath, relativePath);
      const relative = path.relative(normalizedTomePath, absolute);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return false;
      }
      shell.showItemInFolder(absolute);
      return true;
    },
  );

  ipcMain.handle("tome:choosePath", async () => {
    const current = configStore.get("tomePath");
    const result = await dialog.showOpenDialog(win, {
      title: "Change Notes Folder",
      defaultPath: current ?? app.getPath("documents"),
      properties: ["openDirectory", "createDirectory"],
      buttonLabel: "Use This Folder",
    });

    if (result.canceled || !result.filePaths[0]) return null;
    const newPath = result.filePaths[0];
    await mkdir(newPath, { recursive: true });
    configStore.set("tomePath", newPath);
    // Prompt restart
    const { response } = await dialog.showMessageBox(win, {
      type: "info",
      message: "Tome folder changed",
      detail: "Restart Notes to use the new folder.",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
    });
    if (response === 0) {
      app.relaunch();
      app.quit();
    }
    return newPath;
  });

  // Updater IPC
  ipcMain.on("updater:install", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
    autoUpdater.quitAndInstall();
  });
}

async function main(): Promise<void> {
  await app.whenReady();

  buildMenu(() => void ipcMain.emit("tome:choosePath"));

  const isMac = process.platform === "darwin";
  const preloadPath = path.join(__dirname, "preload.js");

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    frame: isMac ? undefined : false,
    titleBarStyle: isMac ? "hiddenInset" : undefined,
    trafficLightPosition: isMac ? { x: 12, y: 14 } : undefined,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Re-build menu with the real win reference for Change Tome Folder.
  buildMenu(async () => {
    await ipcMain.emit("tome:choosePath", null, win);
  });

  // Register IPC handlers before the renderer can issue invokes.
  setupWindowIpc(win);

  win.once("ready-to-show", () => {
    win.show();
    setupAutoUpdater(win);
  });

  if (DEV) {
    await win.loadURL(WEB_DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // Get (or prompt for) the tome path before starting the server.
    const tomePath = await ensureTomePath();

    process.env["NOTES_PACKAGED"] = "1";
    process.env["NOTES_WEB_DIST"] = path.join(process.resourcesPath, "web", "dist");
    const serverPath = path.join(__dirname, "../dist-server/main.js");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { startServer } = require(serverPath) as {
      startServer: (overrides?: {
        tomePath?: string;
      }) => Promise<{ port: number; address: string }>;
    };
    const { port } = await startServer({ tomePath });
    await win.loadURL(`http://127.0.0.1:${port}`);
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void main();
  }
});

void main();
