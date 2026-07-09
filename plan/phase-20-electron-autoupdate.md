# Phase 20 — Electron Auto-Update & First-Launch Tome UX

**Status:** ⬜ Not Started
**Depends on:** 19

## Goal

On first launch the app asks the user to choose (or create) their Notes folder. That path
is persisted via `electron-store` and passed to the server at startup. `electron-updater`
checks GitHub Releases for updates and the React UI shows a banner when an update is ready
to install.

## Tasks

### Task: `electron-store` config  `Wave 1`
Create `apps/desktop/src/config-store.ts`:
```ts
import Store from "electron-store";

interface AppConfig {
  tomePath: string | null;
}

export const configStore = new Store<AppConfig>({
  name: "notes-config",
  defaults: { tomePath: null },
});
```

### Task: First-launch tome path dialog  `Wave 1`
In `apps/desktop/src/main.ts`, before calling `startServer()`:
```ts
import { app, dialog } from "electron";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { configStore } from "./config-store.js";

async function ensureTomePath(): Promise<string> {
  let tomePath = configStore.get("tomePath");
  if (tomePath) return tomePath;

  const defaultPath = path.join(app.getPath("documents"), "Notes");
  const result = await dialog.showOpenDialog({
    title: "Choose your Notes folder",
    defaultPath,
    properties: ["openDirectory", "createDirectory"],
    buttonLabel: "Use This Folder",
  });

  tomePath = result.canceled ? defaultPath : result.filePaths[0];
  await mkdir(tomePath, { recursive: true });
  configStore.set("tomePath", tomePath);
  return tomePath;
}
```
Pass the returned path to `startServer({ tomePath })`.

### Task: Tome path IPC  `Wave 1`
Add to `preload.ts` and `electron-api.d.ts`:
```ts
getTomePath:    () => ipcRenderer.invoke("tome:getPath"),
chooseTomePath: () => ipcRenderer.invoke("tome:choosePath"),
```
IPC handlers in `main.ts`:
- `tome:getPath`    → returns `configStore.get("tomePath")`
- `tome:choosePath` → opens `dialog.showOpenDialog`, updates store, returns new path;
  shows a restart dialog ("Restart required to use the new folder — Restart now?")

### Task: App menu  `Wave 1`
Create `apps/desktop/src/menu.ts`:
```ts
import { app, Menu, shell } from "electron";
export function buildMenu(onChangeTome: () => void) {
  const template = [
    ...(process.platform === "darwin" ? [{
      label: app.name,
      submenu: [
        { role: "about" as const },
        { type: "separator" as const },
        { role: "quit" as const },
      ],
    }] : []),
    {
      label: "File",
      submenu: [
        { label: "Open Tome Folder in Explorer", click: () => {
          const p = configStore.get("tomePath");
          if (p) shell.openPath(p);
        }},
        { label: "Change Tome Folder…", click: onChangeTome },
        { type: "separator" as const },
        { role: "quit" as const },
      ],
    },
    { role: "editMenu" as const },
    { role: "viewMenu" as const },
    { role: "windowMenu" as const },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
```
Call `buildMenu(…)` in `main()` after `app.whenReady()`.

### Task: Auto-updater  `Wave 2`
Create `apps/desktop/src/updater.ts`:
```ts
import { autoUpdater } from "electron-updater";
import type { BrowserWindow } from "electron";

export function setupAutoUpdater(win: BrowserWindow): void {
  if (process.env["ELECTRON_DEV"] === "1") return;   // skip in dev

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) =>
    win.webContents.send("updater:available", info));
  autoUpdater.on("download-progress", (progress) =>
    win.webContents.send("updater:progress", progress));
  autoUpdater.on("update-downloaded", () =>
    win.webContents.send("updater:downloaded"));

  // Delay first check by 5 s so the UI has time to settle.
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);
}
```
Call `setupAutoUpdater(win)` after `win.once("ready-to-show", ...)`.

### Task: Preload additions for updater + tome  `Wave 2`
Add to `preload.ts` and `electron-api.d.ts`:
```ts
onUpdateAvailable:  (cb: (info: unknown) => void) => void;
onUpdateProgress:   (cb: (p: unknown) => void) => void;
onUpdateDownloaded: (cb: () => void) => void;
installUpdate:      () => void;
```
IPC handler for `updater:install` → `autoUpdater.quitAndInstall()`.

### Task: `UpdateBanner` React component  `Wave 2`
Create `apps/web/src/components/update-banner.tsx`:
```tsx
export function UpdateBanner() {
  if (!window.electronAPI) return null;
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    window.electronAPI.onUpdateDownloaded(() => setReady(true));
  }, []);

  if (!ready || dismissed) return null;

  return (
    <div className="update-banner" role="status">
      <span>A new version is ready.</span>
      <button onClick={() => window.electronAPI.installUpdate()}>Restart to update</button>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss">✕</button>
    </div>
  );
}
```
Mount `<UpdateBanner />` near the top of the layout (below `TitleBar`).

## Verification Checklist
- [ ] Fresh install: folder picker appears; chosen folder is used as tome path
- [ ] Folder choice persists across app restarts
- [ ] "Change Tome Folder…" menu item triggers picker and shows restart dialog
- [ ] `autoUpdater.checkForUpdatesAndNotify()` runs without throwing (no update server = graceful no-op)
- [ ] `UpdateBanner` does NOT appear in dev mode
- [ ] `UpdateBanner` appears when update is downloaded (can be simulated with a mock event)
- [ ] "Restart to update" calls `quitAndInstall()`
- [ ] App menu has correct items on macOS and Windows
- [ ] `npm run typecheck` green

## 🛑 GATE
1. Does first-launch folder selection work cleanly?
2. Is the folder remembered correctly across restarts?
3. Any crashes or errors related to the auto-updater?
4. Any blocking issues?

## Git Checkpoint
```
feat: electron auto-update + first-launch tome folder UX

- electron-store: persists tomePath across launches
- First-launch dialog: choose/create Notes folder (defaults to ~/Documents/Notes)
- tome:getPath / tome:choosePath IPC; "Change Tome Folder" menu item
- electron-updater: GitHub Releases provider; checks on startup (5s delay)
- UpdateBanner React component: appears when update downloaded
- App menu: File > Open / Change Tome Folder; macOS Notes > Quit

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Files to stage:
- `apps/desktop/src/config-store.ts` (new)
- `apps/desktop/src/updater.ts` (new)
- `apps/desktop/src/menu.ts` (new)
- `apps/desktop/src/main.ts`
- `apps/desktop/src/preload.ts`
- `apps/desktop/src/electron-api.d.ts`
- `apps/web/src/components/update-banner.tsx` (new)
- `apps/web/src/app.tsx`
- `apps/web/src/styles.css` (UpdateBanner styles)

## Feedback
_(recorded after GATE)_
