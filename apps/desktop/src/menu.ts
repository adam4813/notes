import { app, Menu, shell } from "electron";
import { configStore } from "./config-store";

export function buildMenu(onChangeTome: () => void, onOpenFile?: () => void): void {
  const isMac = process.platform === "darwin";

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ] satisfies Electron.MenuItemConstructorOptions[])
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Open File…",
          accelerator: isMac ? "Cmd+Shift+F" : "Ctrl+Shift+F",
          click: () => onOpenFile?.(),
        },
        {
          label: "Open Tome Folder in Explorer",
          accelerator: isMac ? "Cmd+Shift+O" : "Ctrl+Shift+O",
          click: () => {
            const p = configStore.get("tomePath");
            if (p) void shell.openPath(p);
          },
        },
        {
          label: "Change Tome Folder…",
          click: onChangeTome,
        },
        { type: "separator" as const },
        isMac ? { role: "close" as const } : { role: "quit" as const },
      ],
    },
    { role: "editMenu" as const },
    {
      label: "View",
      submenu: [
        { role: "reload" as const },
        { role: "forceReload" as const },
        { role: "toggleDevTools" as const },
        { type: "separator" as const },
        { role: "resetZoom" as const },
        { role: "zoomIn" as const },
        { role: "zoomOut" as const },
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
      ],
    },
    { role: "windowMenu" as const },
    {
      role: "help" as const,
      submenu: [
        {
          label: "Learn More",
          click: () => void shell.openExternal("https://github.com"),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
