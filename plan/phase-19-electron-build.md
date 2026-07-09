# Phase 19 — Electron Build Pipeline & Installers

**Status:** ✅ Complete
**Depends on:** 17, 18

## Goal

Produce distributable installers for Windows (NSIS), macOS (DMG), and Linux (AppImage)
from a single `npm run package:desktop` command.

## Tasks

### Task: Bundle server with tsup  `Wave 1`
- Create `apps/desktop/tsup.server.config.ts`:
  ```ts
  import { defineConfig } from "tsup";
  export default defineConfig({
    entry: ["../../apps/server/src/main.ts"],
    format: ["cjs"],
    outDir: "dist-server",
    splitting: false,
    sourcemap: true,
    external: ["better-sqlite3"],  // native module; must be available at runtime
  });
  ```
- Server bundle goes to `apps/desktop/dist-server/main.js`.
- `better-sqlite3` is listed as `external` so its native `.node` binary resolves at runtime
  (electron-builder will include the pre-built binary via `extraFiles`).

### Task: Bundle Electron main + preload with tsup  `Wave 1`
- Create `apps/desktop/tsup.electron.config.ts`:
  ```ts
  import { defineConfig } from "tsup";
  export default defineConfig({
    entry: { main: "src/main.ts", preload: "src/preload.ts" },
    format: ["cjs"],
    outDir: "dist-electron",
    splitting: false,
    sourcemap: true,
    external: ["electron"],
  });
  ```

### Task: `electron-builder.yml`  `Wave 1`
Create `apps/desktop/electron-builder.yml`:
```yaml
appId: com.notes.app
productName: Notes
copyright: "Copyright © 2026"

directories:
  buildResources: resources
  output: ../../dist-desktop

files:
  - dist-electron/**
  - dist-server/**
  - "!node_modules"

extraResources:
  - from: ../../apps/web/dist
    to: web/dist
  - from: ../../node_modules/better-sqlite3/build/Release
    to: native/better-sqlite3
    filter: ["*.node"]

win:
  target: nsis
  icon: resources/icon.ico
  artifactName: "Notes-Setup-${version}.exe"

mac:
  target: dmg
  icon: resources/icon.icns
  hardenedRuntime: true
  gatekeeperAssess: false
  artifactName: "Notes-${version}.dmg"

linux:
  target: AppImage
  icon: resources/icon.png
  artifactName: "Notes-${version}.AppImage"

publish:
  provider: github
  releaseType: draft
```

### Task: Icon assets  `Wave 1`
- Create a simple SVG icon (stacked rectangles / notebook motif) at
  `apps/desktop/resources/icon.svg` (512×512 artboard).
- Use `sharp` or a Node script (`apps/desktop/scripts/generate-icons.ts`) to produce:
  - `icon.png` — 512×512 PNG
  - `icon.ico` — Windows multi-resolution (256, 64, 32, 16 px) via `png-to-ico` package
  - `icon.icns` — macOS via `electron-icon-builder` or `iconutil` (macOS only; provide
    a pre-generated `.icns` for cross-platform CI)
- Include the pre-generated `icon.ico` and `icon.icns` in the repo so CI does not need
  macOS to build the Windows/Linux packages.

### Task: Build scripts in root `package.json`  `Wave 1`
```json
"build:server-bundle": "tsup --config apps/desktop/tsup.server.config.ts",
"build:electron-main": "tsup --config apps/desktop/tsup.electron.config.ts",
"build:desktop": "npm run build && npm run build:server-bundle && npm run build:electron-main",
"package:desktop": "npm run build:desktop && electron-builder --config apps/desktop/electron-builder.yml",
"package:desktop:win":   "npm run build:desktop && electron-builder --win   --config apps/desktop/electron-builder.yml",
"package:desktop:mac":   "npm run build:desktop && electron-builder --mac   --config apps/desktop/electron-builder.yml",
"package:desktop:linux": "npm run build:desktop && electron-builder --linux --config apps/desktop/electron-builder.yml"
```

### Task: Fix server import path for production  `Wave 2`
- In `apps/desktop/src/main.ts`, switch server import for production:
  ```ts
  if (DEV) {
    const { startServer } = await import("../../server/src/main.ts");
    await startServer();
  } else {
    const { startServer } = await import(path.join(__dirname, "../dist-server/main.js"));
    await startServer();
  }
  ```
- Also update file path for loading `web/dist/index.html` to use `process.resourcesPath`
  in production: `path.join(process.resourcesPath, "web/dist/index.html")`.

## Verification Checklist
- [ ] `npm run build:desktop` completes without type errors
- [ ] `npm run package:desktop` produces an installer in `dist-desktop/`
- [ ] Installer runs and app opens on the target platform (manual test)
- [ ] Server starts and `GET /health` returns `200` from inside the packaged app
- [ ] Notes UI loads and core functions work (create note, edit, search)
- [ ] App icon appears in dock/taskbar/start menu
- [ ] `npm run typecheck` green

## 🛑 GATE
1. Does the packaged app open and function correctly on your platform?
2. Does the app icon look right?
3. Any native module (better-sqlite3) errors at launch?
4. Any blocking issues?

## Git Checkpoint
```
feat: electron build pipeline — installers for Win/Mac/Linux

- tsup configs for server bundle and electron main/preload
- electron-builder.yml: NSIS (Win), DMG (macOS), AppImage (Linux)
- Icon assets: SVG → PNG/ICO/ICNS
- Root scripts: build:desktop, package:desktop:*

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Files to stage:
- `apps/desktop/tsup.server.config.ts` (new)
- `apps/desktop/tsup.electron.config.ts` (new)
- `apps/desktop/electron-builder.yml` (new)
- `apps/desktop/resources/` (icon assets)
- `apps/desktop/scripts/generate-icons.ts` (new, optional)
- `apps/desktop/src/main.ts` (production path fix)
- `package.json` (root — build/package scripts)

## Feedback

**Date:** 2026-07-09
**Result:** ✅ GATE passed (after 3 iterations)

Issues resolved during implementation:
1. `import.meta.url` undefined in CJS bundle → fixed with `shims:true` in tsup
2. `better-sqlite3` ABI mismatch (Node 24 ABI 137 vs Electron 31 ABI 125) → `prebuild-install` downloads Electron-specific binary to `native-staging/`
3. White screen (`file://` can't call `/api/`) → server serves static files via `@fastify/static`, Electron loads `http://127.0.0.1:{port}` 
4. Port conflict crash → `findFreePort()` scans 8787–8806
