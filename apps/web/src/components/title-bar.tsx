import { useEffect, useState } from "react";

/**
 * Custom window titlebar for Electron. Only renders when `window.electronAPI`
 * is defined (i.e. running inside the desktop app). The web version is
 * completely unaffected — this component returns null in the browser.
 */
export function TitleBar() {
  if (!window.electronAPI) {
    return null;
  }

  return <TitleBarInner />;
}

/** Separate inner component so hooks only run inside Electron. */
function TitleBarInner() {
  const api = window.electronAPI!;
  const isMac = api.platform === "darwin";
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    void api.isMaximized().then(setMaximized);
    return api.onMaximizeChange(setMaximized);
  }, [api]);

  return (
    <div className="title-bar" data-platform={isMac ? "mac" : "win"}>
      {/* Drag region — fills available space, draggable */}
      <div className="title-bar-drag" />
      <span className="title-bar-name">Notes</span>
      {/* On macOS the native traffic-light buttons handle this. */}
      {!isMac && (
        <div className="title-bar-controls">
          <button
            className="title-bar-btn"
            aria-label="Minimize"
            onClick={() => api.minimize()}
          >
            {/* Fluent-style minimize — horizontal line */}
            <svg width="10" height="1" viewBox="0 0 10 1">
              <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button
            className="title-bar-btn"
            aria-label={maximized ? "Restore" : "Maximize"}
            onClick={() => api.maximize()}
          >
            {maximized ? (
              /* Restore — two overlapping squares */
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
                <rect x="0" y="2" width="8" height="8" fill="var(--bg)" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
              /* Maximize — single square */
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            )}
          </button>
          <button
            className="title-bar-btn title-bar-btn--close"
            aria-label="Close"
            onClick={() => api.close()}
          >
            {/* Close — X */}
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
              <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
