interface ShortcutCommand {
  id: string;
  title: string;
  category?: string;
}

interface HelpOverlayProps {
  commands: ShortcutCommand[];
  hotkeyFor: (commandId: string) => string | undefined;
  onClose: () => void;
}

const TIPS: { keys: string; label: string }[] = [
  { keys: "[[", label: "Link to another note (autocomplete)" },
  { keys: "#", label: "Add a tag (autocomplete)" },
  { keys: "Ctrl/Cmd + F", label: "Find & replace in the current note" },
];

/** A lightweight, discoverable list of commands with hotkeys and editor tips. */
export function HelpOverlay({ commands, hotkeyFor, onClose }: HelpOverlayProps) {
  const withKeys = commands
    .map((command) => ({ command, keys: hotkeyFor(command.id) }))
    .filter((entry): entry is { command: ShortcutCommand; keys: string } => Boolean(entry.keys));

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Keyboard shortcuts</h2>
          <button className="btn-ghost" aria-label="Close help" onClick={onClose}>
            ×
          </button>
        </div>

        <section className="settings-section">
          <h3>Commands</h3>
          <ul className="help-list">
            {withKeys.map(({ command, keys }) => (
              <li key={command.id} className="help-row">
                <span>{command.category ? `${command.category}: ${command.title}` : command.title}</span>
                <kbd className="help-keys">{keys}</kbd>
              </li>
            ))}
          </ul>
        </section>

        <section className="settings-section">
          <h3>Editor</h3>
          <ul className="help-list">
            {TIPS.map((tip) => (
              <li key={tip.keys} className="help-row">
                <span>{tip.label}</span>
                <kbd className="help-keys">{tip.keys}</kbd>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
