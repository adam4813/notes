import { useCallback, useEffect, useRef, useState } from "react";

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

/** A simple dropdown menu for the titlebar. */
function TitleBarMenu({
  id,
  label,
  items,
  open,
  onToggle,
  onClose,
}: {
  id: string;
  label: string;
  items: Array<
    | { type: "separator" }
    | { type: "item"; label: string; onClick: () => void; disabled?: boolean }
  >;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClose = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        onCloseMenu();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseMenu();
      }
    };
    document.addEventListener("mousedown", onClose);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClose);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const onCloseMenu = () => onClose();

  return (
    <div className="title-bar-menu" ref={ref}>
      <button
        className={`title-bar-menu-btn ${open ? "title-bar-menu-btn--open" : ""}`}
        aria-expanded={open}
        aria-controls={`title-bar-menu-${id}`}
        onMouseDown={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {label}
      </button>
      {open && (
        <div
          id={`title-bar-menu-${id}`}
          className="title-bar-menu-popup"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {items.map((item, i) =>
            item.type === "separator" ? (
              <div key={i} className="title-bar-menu-sep" />
            ) : (
              <button
                key={i}
                className="title-bar-menu-item"
                disabled={item.disabled}
                onClick={() => {
                  onCloseMenu();
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Separate inner component so hooks only run inside Electron. */
function TitleBarInner() {
  const api = window.electronAPI!;
  const isMac = api.platform === "darwin";
  const [maximized, setMaximized] = useState(false);
  const [openMenu, setOpenMenu] = useState<"file" | "edit" | null>(null);

  useEffect(() => {
    void api.isMaximized().then(setMaximized);
    return api.onMaximizeChange(setMaximized);
  }, [api]);

  const handleChangeTome = useCallback(() => {
    void api.chooseTomePath();
  }, [api]);

  return (
    <div className="title-bar" data-platform={isMac ? "mac" : "win"}>
      {/* On Windows/Linux: show inline menus */}
      {!isMac && (
        <div className="title-bar-menus" onMouseDown={(e) => e.stopPropagation()}>
          <TitleBarMenu
            id="file"
            label="File"
            open={openMenu === "file"}
            onToggle={() => setOpenMenu((current) => (current === "file" ? null : "file"))}
            onClose={() => setOpenMenu((current) => (current === "file" ? null : current))}
            items={[
              { type: "item", label: "Change Tome Folder…", onClick: handleChangeTome },
              { type: "separator" },
              {
                type: "item",
                label: "Quit",
                onClick: () => api.close(),
              },
            ]}
          />
          <TitleBarMenu
            id="edit"
            label="Edit"
            open={openMenu === "edit"}
            onToggle={() => setOpenMenu((current) => (current === "edit" ? null : "edit"))}
            onClose={() => setOpenMenu((current) => (current === "edit" ? null : current))}
            items={[
              { type: "item", label: "Undo", onClick: () => document.execCommand("undo") },
              { type: "item", label: "Redo", onClick: () => document.execCommand("redo") },
              { type: "separator" },
              { type: "item", label: "Cut", onClick: () => document.execCommand("cut") },
              { type: "item", label: "Copy", onClick: () => document.execCommand("copy") },
              { type: "item", label: "Paste", onClick: () => document.execCommand("paste") },
            ]}
          />
        </div>
      )}

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
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
                <rect x="0" y="2" width="8" height="8" fill="var(--bg)" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
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
