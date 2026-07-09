import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,

  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),

  isMaximized: (): Promise<boolean> =>
    ipcRenderer.invoke("window:isMaximized") as Promise<boolean>,

  onMaximizeChange: (cb: (v: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, v: boolean) => cb(v);
    ipcRenderer.on("window:maximizeChange", handler);
    return () => ipcRenderer.removeListener("window:maximizeChange", handler);
  },

  getVersion: (): Promise<string> =>
    ipcRenderer.invoke("app:version") as Promise<string>,

  // Tome path management
  getTomePath: (): Promise<string | null> =>
    ipcRenderer.invoke("tome:getPath") as Promise<string | null>,

  chooseTomePath: (): Promise<string | null> =>
    ipcRenderer.invoke("tome:choosePath") as Promise<string | null>,

  // Auto-updater
  onUpdateAvailable: (cb: (info: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, info: unknown) => cb(info);
    ipcRenderer.on("updater:available", handler);
    return () => ipcRenderer.removeListener("updater:available", handler);
  },

  onUpdateProgress: (cb: (progress: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, progress: unknown) => cb(progress);
    ipcRenderer.on("updater:progress", handler);
    return () => ipcRenderer.removeListener("updater:progress", handler);
  },

  onUpdateDownloaded: (cb: () => void) => {
    ipcRenderer.on("updater:downloaded", cb);
    return () => ipcRenderer.removeListener("updater:downloaded", cb);
  },

  installUpdate: () => ipcRenderer.send("updater:install"),
});
