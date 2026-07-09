import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "../state/app-context";
import type { ThemeMode } from "../state/types";

const NEXT_THEME: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "system",
  system: "light",
  solarized: "light",
  contrast: "light",
};

const THEME_ICON: Record<ThemeMode, string> = {
  light: "☀️",
  dark: "🌙",
  system: "🖥️",
  solarized: "🌗",
  contrast: "◐",
};

interface RibbonProps {
  onNewNote: () => void;
  onCommand: () => void;
  onQuickOpen: () => void;
  onSettings: () => void;
  onSearch: (query: string) => void;
}

function TopBarMenu({
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
    const handlePointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div className="title-bar-menu" ref={ref}>
      <button
        className={`title-bar-menu-btn ${open ? "title-bar-menu-btn--open" : ""}`}
        aria-expanded={open}
        aria-controls={`ribbon-menu-${id}`}
        onMouseDown={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        {label}
      </button>
      {open && (
        <div id={`ribbon-menu-${id}`} className="title-bar-menu-popup" onMouseDown={(event) => event.stopPropagation()}>
          {items.map((item, index) =>
            item.type === "separator" ? (
              <div key={index} className="title-bar-menu-sep" />
            ) : (
              <button
                key={index}
                className="title-bar-menu-item"
                disabled={item.disabled}
                onClick={() => {
                  onClose();
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

export function Ribbon({ onNewNote, onCommand, onQuickOpen, onSettings, onSearch }: RibbonProps) {
  const { state, dispatch } = useWorkspace();
  const electronApi = window.electronAPI;
  const isDesktop = Boolean(electronApi);
  const isMac = electronApi?.platform === "darwin";
  const [maximized, setMaximized] = useState(false);
  const [openMenu, setOpenMenu] = useState<"file" | "edit" | null>(null);

  useEffect(() => {
    if (!electronApi) {
      return;
    }
    void electronApi.isMaximized().then(setMaximized);
    return electronApi.onMaximizeChange(setMaximized);
  }, [electronApi]);

  const handleChangeTome = useCallback(() => {
    void electronApi?.chooseTomePath();
  }, [electronApi]);

  return (
    <header className={`ribbon ${isDesktop ? "ribbon--desktop" : ""}`}>
      <div className="ribbon-left">
        <span className="ribbon-brand">📓 Notes</span>
        <div className="title-bar-menus" onMouseDown={(event) => event.stopPropagation()}>
          {isDesktop && (
            <TopBarMenu
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
                  onClick: () => electronApi?.close(),
                },
              ]}
            />
          )}
          <TopBarMenu
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
      </div>
      <div className="ribbon-search">
        <input
          className="ribbon-search-input"
          type="search"
          placeholder="Search notes…"
          aria-label="Search notes"
          onFocus={(event) => onSearch(event.currentTarget.value)}
          onChange={(event) => onSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSearch((event.target as HTMLInputElement).value);
            }
          }}
        />
      </div>

      <div className="ribbon-right">
        <div className="ribbon-actions">
          <button className="btn-ghost" title="New note" aria-label="New note" onClick={onNewNote}>
            ＋
          </button>
          <button
            className="btn-ghost"
            title="Quick switcher (Ctrl/Cmd+O)"
            aria-label="Quick switcher"
            onClick={onQuickOpen}
          >
            🔍
          </button>
          <button
            className="btn-ghost"
            title="Command palette (Ctrl/Cmd+P)"
            aria-label="Command palette"
            onClick={onCommand}
          >
            ⌘
          </button>
          <button className="btn-ghost" title="Settings" aria-label="Settings" onClick={onSettings}>
            ⚙
          </button>
          <button
            className="btn-ghost"
            title={`Theme: ${state.theme}`}
            aria-label={`Theme: ${state.theme}`}
            data-testid="theme-toggle"
            onClick={() => dispatch({ type: "setTheme", theme: NEXT_THEME[state.theme] })}
          >
            {THEME_ICON[state.theme]}
          </button>
        </div>

        {isDesktop && !isMac && (
          <div className="title-bar-controls">
            <button
              className="title-bar-btn"
              aria-label="Minimize"
              onClick={() => electronApi?.minimize()}
            >
              <svg width="10" height="1" viewBox="0 0 10 1">
                <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
            <button
              className="title-bar-btn"
              aria-label={maximized ? "Restore" : "Maximize"}
              onClick={() => electronApi?.maximize()}
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
              onClick={() => electronApi?.close()}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
                <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
