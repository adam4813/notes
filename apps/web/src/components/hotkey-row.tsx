import { useState } from "react";
import type { SettingsCommand } from "./settings-view";

interface HotkeyRowProps {
  command: SettingsCommand;
  combo: string | undefined;
  format: (combo: string) => string;
  custom: boolean;
  conflictWith?: string;
  onRebind: (combo: string) => void;
  onReset: () => void;
}

const MODIFIER_KEYS = new Set(["Control", "Meta", "Alt", "Shift"]);

/** A single rebindable hotkey row that captures the next key press. */
export function HotkeyRow({
  command,
  combo,
  format,
  custom,
  conflictWith,
  onRebind,
  onReset,
}: HotkeyRowProps) {
  const [capturing, setCapturing] = useState(false);

  const onKeyDown = (event: React.KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setCapturing(false);
      return;
    }
    // Wait for a non-modifier key to complete the combo.
    if (MODIFIER_KEYS.has(event.key)) {
      return;
    }
    const parts: string[] = [];
    if (event.metaKey) {
      parts.push("Meta");
    }
    if (event.ctrlKey) {
      parts.push("Ctrl");
    }
    if (event.altKey) {
      parts.push("Alt");
    }
    if (event.shiftKey) {
      parts.push("Shift");
    }
    parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
    onRebind(parts.join("+"));
    setCapturing(false);
  };

  const display = combo ? format(combo) : "Unassigned";

  return (
    <li className={`hotkey-row ${conflictWith ? "hotkey-row--conflict" : ""}`}>
      <div className="hotkey-meta">
        <span className="hotkey-title">
          {command.category ? `${command.category}: ${command.title}` : command.title}
        </span>
        {conflictWith && (
          <span className="hotkey-conflict">Conflicts with {conflictWith}</span>
        )}
      </div>
      <div className="hotkey-controls">
        <button
          className={`hotkey-combo ${capturing ? "hotkey-combo--capturing" : ""}`}
          data-testid={`hotkey-${command.id}`}
          onClick={() => setCapturing(true)}
          onKeyDown={capturing ? onKeyDown : undefined}
          onBlur={() => setCapturing(false)}
        >
          {capturing ? "Press keys…" : display}
        </button>
        {custom && (
          <button className="btn-ghost hotkey-reset" title="Reset to default" onClick={onReset}>
            ↺
          </button>
        )}
      </div>
    </li>
  );
}
