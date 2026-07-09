# Phase 17 — Electron Core Scaffold & Dev Workflow

**Status:** ✅ Complete
**Depends on:** 0–12

## Goal

Create a new `apps/desktop` package that wraps the Notes app as a native Electron desktop
application. The Electron main process starts the existing Fastify server in-process and
loads the React UI in a `BrowserWindow`. A `dev:all` script runs server + web + Electron
concurrently for a seamless development workflow.

## Tasks

### Task: Create `apps/desktop` package  `Wave 1`
- `apps/desktop/package.json`:
  ```json
  {
    "name": "@notes/desktop",
    "version": "0.0.0",
    "private": true,
    "type": "module",
    "main": "dist-electron/main.js",
    "scripts": {
      "dev": "tsx src/main.ts",
      "build:electron": "tsup src/main.ts src/preload.ts --format cjs --outDir dist-electron --no-splitting",
      "typecheck": "tsc --noEmit"
    }
  }
  ```
- Dependencies: `electron`, `electron-builder`, `electron-updater`, `electron-store`, `tsup`
- Dev dependencies: `@types/electron` (if needed), `tsx`
- `apps/desktop/tsconfig.json` extending `../../tsconfig.base.json` with
  `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"target": "ES2022"`

### Task: Server startup refactor  `Wave 1`
- Refactor `apps/server/src/main.ts`: extract a named `export async function startServer(overrides?: Partial<Config>): Promise<void>` 
- Guard the direct-run call:
  ```ts
  if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
    void startServer();
  }
  ```
- This allows Electron to `import { startServer } from "@notes/server/src/main.js"` without
  double-starting the server.

### Task: Electron main process (`src/main.ts`)  `Wave 2`
```ts
import { app, BrowserWindow } from "electron";
import path from "node:path";

const DEV = process.env["ELECTRON_DEV"] === "1";
const WEB_DEV_URL = "http://localhost:5173";

async function main() {
  await app.whenReady();

  // Start the Fastify server (same Node.js process).
  const { startServer } = await import("../../server/src/main.js");
  await startServer();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,   // shown on ready-to-show to avoid flash
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  if (DEV) {
    await win.loadURL(WEB_DEV_URL);
    win.webContents.openDevTools();
  } else {
    await win.loadFile(path.join(__dirname, "../web/dist/index.html"));
  }

  // IPC handlers (see preload task).
  setupWindowIpc(win);
}

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
```

### Task: Preload script (`src/preload.ts`)  `Wave 2`
```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  minimize:    () => ipcRenderer.send("window:minimize"),
  maximize:    () => ipcRenderer.send("window:maximize"),
  close:       () => ipcRenderer.send("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  onMaximizeChange: (cb: (v: boolean) => void) => {
    const handler = (_: unknown, v: boolean) => cb(v);
    ipcRenderer.on("window:maximizeChange", handler);
    return () => ipcRenderer.removeListener("window:maximizeChange", handler);
  },
  getVersion: () => ipcRenderer.invoke("app:version"),
});
```

IPC handlers in `main.ts` (`setupWindowIpc`):
- `window:minimize` → `win.minimize()`
- `window:maximize` → `win.isMaximized() ? win.unmaximize() : win.maximize()`
- `window:close`    → `win.close()`
- `window:isMaximized` → returns `win.isMaximized()`
- `app:version`    → returns `app.getVersion()`
- Fire `window:maximizeChange` on `maximize` / `unmaximize` window events.

### Task: Type declarations for `window.electronAPI`  `Wave 2`
- Create `apps/desktop/src/electron-api.d.ts`:
  ```ts
  interface ElectronAPI {
    platform: string;
    minimize(): void;
    maximize(): void;
    close(): void;
    isMaximized(): Promise<boolean>;
    onMaximizeChange(cb: (v: boolean) => void): () => void;
    getVersion(): Promise<string>;
  }
  interface Window { electronAPI?: ElectronAPI; }
  ```
- Reference in `apps/web/src/vite-env.d.ts`: `/// <reference path="../../desktop/src/electron-api.d.ts" />`

### Task: Dev workflow scripts  `Wave 2`
- Root `package.json` additions:
  ```json
  "dev:desktop": "ELECTRON_DEV=1 electron apps/desktop/src/main.ts",
  "dev:all": "concurrently -n server,web,electron -c blue,green,yellow \"npm:dev:server\" \"npm:dev:web\" \"npm:dev:desktop\""
  ```
- On Windows, `ELECTRON_DEV=1` → `cross-env ELECTRON_DEV=1` (add `cross-env` to root devDeps).

## Verification Checklist
- [ ] `npm run dev:all` starts server, web, and Electron concurrently
- [ ] Electron window appears and loads the Notes UI from `localhost:5173`
- [ ] `GET /health` is reachable from within the Electron renderer (proxy works)
- [ ] `window.electronAPI` is available in DevTools console
- [ ] `window.electronAPI.platform` returns the correct OS string
- [ ] No IPC errors or uncaught exceptions in DevTools or main-process console
- [ ] `npm run typecheck` green across the monorepo (including `apps/desktop`)

## 🛑 GATE
1. Does `dev:all` start cleanly without race conditions between server, web, and Electron?
2. Does the Notes UI function fully inside Electron (notes CRUD, canvas, boards, search)?
3. Any IPC type errors?
4. Any blocking issues?

## Git Checkpoint
```
feat: electron core scaffold — main process, preload IPC bridge, dev:all script

- apps/desktop package with Electron main + preload
- Refactor apps/server/src/main.ts to export startServer()
- window.electronAPI: platform, minimize/maximize/close, version
- dev:all concurrently script; ELECTRON_DEV flag for dev/prod loading

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Files to stage:
- `apps/desktop/` (new package — all files)
- `apps/server/src/main.ts`
- `apps/web/src/vite-env.d.ts`
- `package.json` (root — scripts + cross-env)

## Feedback

**Date:** 2026-07-08
**Result:** ✅ GATE passed

- dev:all starts cleanly: server, web, and Electron all run concurrently
- Notes UI fully functional inside Electron
- window.electronAPI available with all expected properties
- Pre-existing warning in console: "flushSync was called from inside a lifecycle method" (from TipTap RenderedEditor) — present on both desktop and web, non-blocking, deferred
