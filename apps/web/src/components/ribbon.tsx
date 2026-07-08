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
}

export function Ribbon({ onNewNote, onCommand, onQuickOpen, onSettings }: RibbonProps) {
  const { state, dispatch } = useWorkspace();
  return (
    <header className="ribbon">
      <span className="ribbon-brand">📓 Notes</span>
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
    </header>
  );
}
