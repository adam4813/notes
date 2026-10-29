import type { StatusBarItem } from "@notes/plugin-host";
import type { ThemeMeta } from "@notes/shared";
import { getErrorWarnCount, onClear, onLog } from "@notes/shared";
import { useEffect, useRef, useState } from "react";
import { PopupMenu } from "@notes/ui";
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
  consoleOpen,
  onToggleConsole,
}: {
  pluginItems: StatusBarItem[];
  theme: ThemeMode;
  externalThemes: ThemeMeta[];
  onThemeChange: (theme: ThemeMode) => void;
  onOpenSettings: () => void;
  consoleOpen: boolean;
  onToggleConsole: () => void;
}) {
  const { state } = useWorkspace();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [warnCount, setWarnCount] = useState(0);
  // Track counts across renders without stale closure issues
  const countsRef = useRef({ errors: 0, warns: 0 });
  const noteCount = flattenFiles(state.tree).length;
  const activePane = state.panes.find((pane) => pane.id === state.activePaneId);
  const activeTab = activePane?.tabs.find((tab) => tab.id === activePane.activeTabId);
  const selectedTheme = uiThemeValue(theme);
  const canToggleMode = selectedTheme === "default";
  const modeIcon = theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "🖥️";

  // Subscribe to log events for badge count; badge resets when console closes (buffer clear)
  useEffect(() => {
    const initial = getErrorWarnCount();
    countsRef.current = initial;
    setErrorCount(initial.errors);
    setWarnCount(initial.warns);

    const unsubLog = onLog((entry) => {
      if (consoleOpen) return; // pane is visible; badge stays at 0
      if (entry.level === "error") {
        countsRef.current = { ...countsRef.current, errors: countsRef.current.errors + 1 };
        setErrorCount(countsRef.current.errors);
      } else if (entry.level === "warn") {
        countsRef.current = { ...countsRef.current, warns: countsRef.current.warns + 1 };
        setWarnCount(countsRef.current.warns);
      }
    });
    const unsubClear = onClear(() => {
      countsRef.current = { errors: 0, warns: 0 };
      setErrorCount(0);
      setWarnCount(0);
    });
    return () => {
      unsubLog();
      unsubClear();
    };
  // Re-subscribe when consoleOpen changes so the guard captures the latest value
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoleOpen]);

  const themeOptions: { value: string; label: string }[] = [
    { value: "default", label: "Default" },
    { value: "solarized", label: "Solarized" },
    { value: "contrast", label: "High contrast" },
    ...externalThemes.map((themeMeta) => ({ value: themeMeta.id, label: themeMeta.name })),
  ];
  const selectedThemeLabel =
    themeOptions.find((option) => option.value === selectedTheme)?.label ?? "Default";

  return (
    <footer className="status-bar">
      <span className="status-controls">
        <button
          className="status-action-btn"
          title="Settings"
          aria-label="Settings"
          onClick={onOpenSettings}
        >
          ⚙
        </button>
        <div>
          <PopupMenu
            open={themeMenuOpen}
            onClose={() => setThemeMenuOpen(false)}
            style={{
              position: "fixed",
              left: 4,
              bottom: 28,
              top: "unset",
              right: "unset",
            }}
            menu={
              <>
                {themeOptions.map((option) => (
                  <button
                    key={option.value}
                    role="menuitemradio"
                    aria-checked={selectedTheme === option.value}
                    onClick={() => {
                      onThemeChange(resolveThemeSelection(option.value, theme));
                      setThemeMenuOpen(false);
                    }}
                  >
                    {selectedTheme === option.value ? "✓ " : ""}
                    {option.label}
                  </button>
                ))}
              </>
            }
          >
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
          </PopupMenu>
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
      <ConsoleToggleButton
        open={consoleOpen}
        errorCount={consoleOpen ? 0 : errorCount}
        warnCount={consoleOpen ? 0 : warnCount}
        onToggle={onToggleConsole}
      />
    </footer>
  );
}

function ConsoleDot({ errorCount, warnCount }: { errorCount: number; warnCount: number }) {
  if (errorCount > 0) {
    return <span className="console-badge console-badge--error" aria-hidden="true" />;
  }
  if (warnCount > 0) {
    return <span className="console-badge console-badge--warn" aria-hidden="true" />;
  }
  return null;
}

function ConsoleToggleButton({
  open,
  errorCount,
  warnCount,
  onToggle,
}: {
  open: boolean;
  errorCount: number;
  warnCount: number;
  onToggle: () => void;
}) {
  const total = errorCount + warnCount;
  const label = open
    ? "Close Console"
    : total > 0
      ? `Open Console (${total} issue${total !== 1 ? "s" : ""})`
      : "Open Console";

  return (
    <button
      className={`status-action-btn status-console-btn${open ? " status-console-btn--open" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={open}
      onClick={onToggle}
    >
      <ConsoleDot errorCount={errorCount} warnCount={warnCount} />
      <span>⌘</span>
      {total > 0 && !open && <span className="console-badge-count">{total}</span>}
    </button>
  );
}
