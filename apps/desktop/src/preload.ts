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
});
