import { useWorkspace } from "../state/app-context";
import type { ThemeMode } from "../state/types";

const NEXT_THEME: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const THEME_ICON: Record<ThemeMode, string> = {
  light: "☀️",
  dark: "🌙",
  system: "🖥️",
};

interface RibbonProps {
  onNewNote: () => void;
  onCommand: () => void;
  onQuickOpen: () => void;
}

export function Ribbon({ onNewNote, onCommand, onQuickOpen }: RibbonProps) {
  const { state, dispatch } = useWorkspace();
  return (
    <header className="ribbon">
      <span className="ribbon-brand">📓 Notes</span>
      <div className="ribbon-actions">
        <button className="btn-ghost" title="New note" onClick={onNewNote}>
          ＋
        </button>
        <button className="btn-ghost" title="Quick switcher (Ctrl/Cmd+O)" onClick={onQuickOpen}>
          🔍
        </button>
        <button className="btn-ghost" title="Command palette (Ctrl/Cmd+P)" onClick={onCommand}>
          ⌘
        </button>
        <button
          className="btn-ghost"
          title={`Theme: ${state.theme}`}
          data-testid="theme-toggle"
          onClick={() => dispatch({ type: "setTheme", theme: NEXT_THEME[state.theme] })}
        >
          {THEME_ICON[state.theme]}
        </button>
      </div>
    </header>
  );
}
