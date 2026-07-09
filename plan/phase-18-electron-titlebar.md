# Phase 18 — Electron Chromeless Window & Titlebar

**Status:** ⬜ Not Started
**Depends on:** 17

## Goal

Remove the OS window frame and replace it with a custom React titlebar that is
platform-aware: macOS keeps its native traffic-light buttons (hidden frame with inset);
Windows and Linux get custom SVG minimize/maximize/close buttons. The drag region is CSS-
controlled. The titlebar only renders inside Electron — the web version is unaffected.

## Tasks

### Task: Update BrowserWindow for chromeless mode  `Wave 1`
- In `apps/desktop/src/main.ts`, update the `BrowserWindow` constructor:
  ```ts
  const isMac = process.platform === "darwin";
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    frame: !isMac,                              // false on Win/Linux
    titleBarStyle: isMac ? "hiddenInset" : undefined,
    trafficLightPosition: isMac ? { x: 12, y: 14 } : undefined,
    webPreferences: { ... },
  });
  ```
- On macOS `hiddenInset` keeps native traffic lights; `frame: false` is used on Win/Linux.

### Task: `TitleBar` React component  `Wave 1`
Create `apps/web/src/components/title-bar.tsx`:

```tsx
export function TitleBar() {
  if (!window.electronAPI) return null;   // not in Electron — render nothing

  const isMac = window.electronAPI.platform === "darwin";
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    window.electronAPI.isMaximized().then(setMaximized);
    return window.electronAPI.onMaximizeChange(setMaximized);
  }, []);

  return (
    <div className="title-bar" data-platform={isMac ? "mac" : "win"}>
      <div className="title-bar-drag" />
      <span className="title-bar-name">Notes</span>
      {!isMac && (
        <div className="title-bar-controls">
          <button onClick={() => window.electronAPI.minimize()} aria-label="Minimize">
            {/* SVG minimize icon */}
          </button>
          <button onClick={() => window.electronAPI.maximize()} aria-label={maximized ? "Restore" : "Maximize"}>
            {/* SVG maximize/restore icon */}
          </button>
          <button className="close" onClick={() => window.electronAPI.close()} aria-label="Close">
            {/* SVG close icon */}
          </button>
        </div>
      )}
    </div>
  );
}
```

SVG icons: use minimal Fluent-style icons consistent with Windows 11 conventions.
Buttons have no background by default; close button turns red on hover.

### Task: Wire TitleBar into App layout  `Wave 1`
- In `apps/web/src/app.tsx` (or the root layout): render `<TitleBar />` as the first child,
  above the main shell.
- Add a CSS variable `--titlebar-height` (36px Win/Linux, 0 on macOS / non-Electron) so
  the rest of the layout can offset correctly.

### Task: CSS for the titlebar  `Wave 1`
In `apps/web/src/styles.css`:
```css
.title-bar {
  height: var(--titlebar-height, 0px);
  display: flex;
  align-items: center;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  user-select: none;
  flex-shrink: 0;
}
.title-bar[data-platform="mac"] {
  --titlebar-height: 28px;
  padding-left: 72px;   /* safe zone for traffic lights */
}
.title-bar[data-platform="win"] {
  --titlebar-height: 36px;
}
.title-bar-drag {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag;
}
.title-bar-name {
  font-size: 12px;
  color: var(--color-text-muted);
  pointer-events: none;
}
.title-bar-controls {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}
.title-bar-controls button {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.title-bar-controls button:hover { background: var(--color-bg-hover); }
.title-bar-controls button.close:hover { background: #c42b1c; color: #fff; }
```
- Theme-aware: uses existing CSS variables from the theming system.
- The `.app-shell` gets `padding-top: var(--titlebar-height, 0px)` removed (titlebar is
  now part of the layout flow, not an overlay).

### Task: Update `electron-api.d.ts`  `Wave 1`
Ensure `isMaximized`, `onMaximizeChange`, `platform` are all typed correctly.

## Verification Checklist
- [ ] Electron window opens with no OS frame on Windows/Linux
- [ ] macOS shows native traffic lights (Cmd+W, Cmd+M, yellow dot) in correct position
- [ ] Custom titlebar renders with app name and controls on Windows/Linux
- [ ] Window is draggable by clicking and dragging the title area
- [ ] Minimize / maximize / close buttons work correctly
- [ ] Maximize icon toggles between maximize and restore glyphs
- [ ] Titlebar is theme-aware (looks good in both light and dark)
- [ ] Web version (non-Electron) shows no titlebar at all
- [ ] `npm run typecheck` green

## 🛑 GATE
1. Does the custom titlebar look polished? Any visual issues on your platform?
2. Is the window drag region large enough / not obscuring content?
3. macOS: are traffic lights properly positioned?
4. Any blocking issues?

## Git Checkpoint
```
feat: electron chromeless window + custom React titlebar

- BrowserWindow: frame:false (Win/Linux), titleBarStyle:hiddenInset (macOS)
- TitleBar component: platform-aware, drag region, Win/Linux SVG controls
- CSS: --titlebar-height variable, theme-aware, Windows close=red hover
- TitleBar only renders inside Electron; web mode unaffected

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Files to stage:
- `apps/desktop/src/main.ts`
- `apps/desktop/src/electron-api.d.ts`
- `apps/web/src/components/title-bar.tsx` (new)
- `apps/web/src/app.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/vite-env.d.ts`

## Feedback
_(recorded after GATE)_
