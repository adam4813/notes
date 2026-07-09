import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";

const DEV = process.env["ELECTRON_DEV"] === "1";
const WEB_DEV_URL = "http://localhost:5173";

function setupWindowIpc(win: BrowserWindow): void {
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
}

async function main(): Promise<void> {
  await app.whenReady();

  const isMac = process.platform === "darwin";
  const preloadPath = path.join(__dirname, "preload.js");

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    // Chromeless: custom titlebar in React handles window controls.
    // macOS: use hiddenInset to keep native traffic lights.
    // Win/Linux: frame:false removes the OS titlebar entirely.
    frame: isMac ? undefined : false,
    titleBarStyle: isMac ? "hiddenInset" : undefined,
    trafficLightPosition: isMac ? { x: 12, y: 14 } : undefined,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  if (DEV) {
    // Dev: server runs separately; Electron is just the window host.
    await win.loadURL(WEB_DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // Production: start the bundled server (serves web UI too), then load via http.
    process.env["NOTES_PACKAGED"] = "1";
    process.env["NOTES_WEB_DIST"] = path.join(process.resourcesPath, "web", "dist");
    const serverPath = path.join(__dirname, "../dist-server/main.js");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { startServer } = require(serverPath) as {
      startServer: () => Promise<{ port: number; address: string }>;
    };
    const { port } = await startServer();
    // Load from the server URL so /api and /ws requests work on the same origin.
    await win.loadURL(`http://127.0.0.1:${port}`);
  }

  setupWindowIpc(win);
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
