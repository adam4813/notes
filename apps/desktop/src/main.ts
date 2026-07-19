import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  ipcMain.removeHandler("file:openDialog");
  ipcMain.removeHandler("file:readStandalone");
  ipcMain.removeHandler("file:writeStandalone");

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

  // Standalone file operations (files opened outside the Tome)
  ipcMain.handle("file:openDialog", async () => {
    const result = await dialog.showOpenDialog(win, {
      title: "Open Markdown File",
      properties: ["openFile"],
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const absPath = result.filePaths[0];
    return { absPath, name: path.basename(absPath) };
  });

  ipcMain.handle("file:readStandalone", async (_event, absPath: unknown) => {
    if (typeof absPath !== "string" || !absPath.trim()) {
      throw new Error("Invalid path");
    }
    return readFile(absPath, "utf-8");
  });

  ipcMain.handle(
    "file:writeStandalone",
    async (_event, payload: { absPath?: unknown; content?: unknown }) => {
      const { absPath, content } = payload;
      if (typeof absPath !== "string" || !absPath.trim() || typeof content !== "string") {
        throw new Error("Invalid payload");
      }
      await writeFile(absPath, content, "utf-8");
    },
  );

  // Updater IPC
  ipcMain.on("updater:install", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
    autoUpdater.quitAndInstall();
  });
}

async function main(): Promise<void> {
  await app.whenReady();

  // placeholder menu before win is created
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

  // Rebuild menu with the real win reference so dialogs are parented to the window.
  buildMenu(
    async () => ipcMain.emit("tome:choosePath", null, win),
    async () => {
      const result = await dialog.showOpenDialog(win, {
        title: "Open Markdown File",
        properties: ["openFile"],
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!result.canceled && result.filePaths[0]) {
        win.webContents.send("file:openWith", result.filePaths[0]);
      }
    },
  );

  // Register IPC handlers before the renderer can issue invokes.
  setupWindowIpc(win);

  // Collect any .md file passed on the command line (Windows/Linux "Open with").
  const argFile = process.argv
    .slice(DEV ? 2 : 1)
    .find((arg) => !arg.startsWith("-") && arg.toLowerCase().endsWith(".md"));

  // Deliver a pending "open-with" file path once the renderer finishes loading.
  const sendOpenWith = (filePath: string) => {
    win.webContents.once("did-finish-load", () => {
      win.webContents.send("file:openWith", filePath);
    });
  };

  if (argFile) {
    sendOpenWith(path.resolve(argFile));
  }

  // macOS: handle "Open With" from Finder (fires after app.whenReady resolves).
  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    if (filePath.toLowerCase().endsWith(".md")) {
      sendOpenWith(filePath);
    }
  });

  win.once("ready-to-show", () => {
    win.show();
    setupAutoUpdater(win);
  });

  if (DEV) {
    const devUrl = argFile ? `${WEB_DEV_URL}?standalone=1` : WEB_DEV_URL;
    await win.loadURL(devUrl);
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
    const prodUrl = argFile ? `http://127.0.0.1:${port}?standalone=1` : `http://127.0.0.1:${port}`;
    await win.loadURL(prodUrl);
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
