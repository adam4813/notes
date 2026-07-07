import { useEffect, useMemo, useRef, useState } from "react";
import type { FileEntry } from "../api/client";
import { fuzzyRank } from "../lib/fuzzy";
import type { AppCommand } from "../state/commands";

interface PaletteResult {
  key: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface PaletteProps {
  mode: "files" | "commands";
  files: FileEntry[];
  commands: AppCommand[];
  recentCommandIds: string[];
  hotkeyFor: (commandId: string) => string | undefined;
  onOpenFile: (path: string, title: string) => void;
  onRunCommand: (command: AppCommand) => void;
  onCreateNote: (name: string) => void;
  onClose: () => void;
}

export function Palette({
  mode,
  files,
  commands,
  recentCommandIds,
  hotkeyFor,
  onOpenFile,
  onRunCommand,
  onCreateNote,
  onClose,
}: PaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo<PaletteResult[]>(() => {
    const trimmed = query.trim();

    if (mode === "commands") {
      const toResult = (command: AppCommand): PaletteResult => ({
        key: command.id,
        label: command.title,
        hint: hotkeyFor(command.id),
        run: () => onRunCommand(command),
      });

      if (trimmed.length === 0) {
        // Recents first, then everything else in registration order.
        const recent = recentCommandIds
          .map((id) => commands.find((command) => command.id === id))
          .filter((command): command is AppCommand => Boolean(command));
        const rest = commands.filter((command) => !recentCommandIds.includes(command.id));
        return [...recent, ...rest].map(toResult);
      }

      return fuzzyRank(trimmed, commands, (command) =>
        command.category ? `${command.category} ${command.title}` : command.title,
      ).map((ranked) => toResult(ranked.item));
    }

    const ranked = fuzzyRank(trimmed, files, (file) => file.path)
      .slice(0, 50)
      .map<PaletteResult>((entry) => ({
        key: entry.item.path,
        label: entry.item.path,
        run: () => onOpenFile(entry.item.path, entry.item.name.replace(/\.[^.]+$/, "")),
      }));

    // Create-on-miss: offer to make a note named after the query.
    if (trimmed.length > 0 && !files.some((file) => file.path === trimmed)) {
      ranked.push({
        key: "__create__",
        label: `Create note "${trimmed}"`,
        hint: "Enter",
        run: () => onCreateNote(trimmed),
      });
    }
    return ranked;
  }, [
    query,
    mode,
    files,
    commands,
    recentCommandIds,
    hotkeyFor,
    onOpenFile,
    onRunCommand,
    onCreateNote,
  ]);

  useEffect(() => {
    setActive(0);
  }, [query, mode]);

  const runAt = (index: number) => {
    const result = results[index];
    if (result) {
      result.run();
      onClose();
    }
  };

  return (
    <div className="palette-overlay" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          data-testid="palette-input"
          placeholder={mode === "commands" ? "Run a command…" : "Open or create a note…"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              runAt(active);
            } else if (event.key === "Escape") {
              onClose();
            }
          }}
        />
        <ul className="palette-list">
          {results.map((result, index) => (
            <li key={result.key}>
              <button
                className={`palette-item ${index === active ? "palette-item--active" : ""}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => runAt(index)}
              >
                <span className="palette-item-label">{result.label}</span>
                {result.hint && <kbd className="palette-item-hint">{result.hint}</kbd>}
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="palette-empty">No matches</li>}
        </ul>
      </div>
    </div>
  );
}
