import type { StatusBarItem } from "@notes/plugin-host";
import type { ThemeMeta } from "@notes/shared";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../state/app-context";
import { flattenFiles } from "../state/selectors";
import { PluginStatusItems } from "./plugin-status-items";
import type { ThemeMode } from "../state/types";

function isDefaultTheme(theme: ThemeMode): boolean {
  return theme === "light" || theme === "dark" || theme === "system";
}

function uiThemeValue(theme: ThemeMode): string {
  return isDefaultTheme(theme) ? "default" : theme;
}

function resolveThemeSelection(next: string, current: ThemeMode): ThemeMode {
  if (next !== "default") {
    return next;
  }
  if (isDefaultTheme(current)) {
    return current;
  }
  return "system";
}

export function StatusBar({
  pluginItems,
  theme,
  externalThemes,
  onThemeChange,
  onOpenSettings,
}: {
  pluginItems: StatusBarItem[];
  theme: ThemeMode;
  externalThemes: ThemeMeta[];
  onThemeChange: (theme: ThemeMode) => void;
  onOpenSettings: () => void;
}) {
  const { state } = useWorkspace();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const noteCount = flattenFiles(state.tree).length;
  const activePane = state.panes.find((pane) => pane.id === state.activePaneId);
  const activeTab = activePane?.tabs.find((tab) => tab.id === activePane.activeTabId);
  const selectedTheme = uiThemeValue(theme);
  const canToggleMode = selectedTheme === "default";
  const modeIcon = theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "🖥️";

  useEffect(() => {
    if (!themeMenuOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [themeMenuOpen]);

  const themeOptions: { value: string; label: string }[] = [
    { value: "default", label: "Default" },
    { value: "solarized", label: "Solarized" },
    { value: "contrast", label: "High contrast" },
    ...externalThemes.map((themeMeta) => ({ value: themeMeta.id, label: themeMeta.name })),
  ];
  const selectedThemeLabel = themeOptions.find((option) => option.value === selectedTheme)?.label ?? "Default";

  return (
    <footer className="status-bar">
      <span className="status-controls">
        <button className="status-action-btn" title="Settings" aria-label="Settings" onClick={onOpenSettings}>
          ⚙
        </button>
        <div className="status-menu-wrap" ref={themeMenuRef}>
          <button
            className="status-action-btn"
            title={`Theme: ${selectedThemeLabel}`}
            aria-label={`Theme: ${selectedThemeLabel}`}
            aria-haspopup="menu"
            aria-expanded={themeMenuOpen}
            onClick={() => setThemeMenuOpen((open) => !open)}
          >
            {selectedThemeLabel} ▴
          </button>
          {themeMenuOpen && (
            <div className="status-menu-popup" role="menu">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  role="menuitemradio"
                  aria-checked={selectedTheme === option.value}
                  className="status-menu-item"
                  onClick={() => {
                    onThemeChange(resolveThemeSelection(option.value, theme));
                    setThemeMenuOpen(false);
                  }}
                >
                  {selectedTheme === option.value ? "✓ " : ""}{option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {canToggleMode && (
          <button
            className="status-action-btn"
            title="Cycle mode (Light/Dark/System)"
            aria-label="Cycle mode (Light/Dark/System)"
            onClick={() =>
              onThemeChange(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")
            }
          >
            {modeIcon}
          </button>
        )}
      </span>
      <span>{noteCount} notes</span>
      <span className="status-message">{state.status}</span>
      <PluginStatusItems items={pluginItems} />
      <span className="status-path">{activeTab?.path ?? "—"}</span>
    </footer>
  );
}
