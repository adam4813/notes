import { useEffect, useMemo, useRef, useState } from "react";
import type { FileEntry } from "../api/client";

export interface PaletteCommand {
  id: string;
  label: string;
  run: () => void;
}

interface PaletteResult {
  key: string;
  label: string;
  run: () => void;
}

interface PaletteProps {
  mode: "files" | "commands";
  files: FileEntry[];
  commands: PaletteCommand[];
  onOpenFile: (path: string, title: string) => void;
  onClose: () => void;
}

export function Palette({ mode, files, commands, onOpenFile, onClose }: PaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo<PaletteResult[]>(() => {
    const needle = query.trim().toLowerCase();
    if (mode === "commands") {
      return commands
        .filter((command) => command.label.toLowerCase().includes(needle))
        .map((command) => ({ key: command.id, label: command.label, run: command.run }));
    }
    return files
      .filter((file) => file.path.toLowerCase().includes(needle))
      .slice(0, 50)
      .map((file) => ({
        key: file.path,
        label: file.path,
        run: () => onOpenFile(file.path, file.name.replace(/\.[^.]+$/, "")),
      }));
  }, [query, mode, files, commands, onOpenFile]);

  const runFirst = () => {
    const first = results[0];
    if (first) {
      first.run();
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
          placeholder={mode === "commands" ? "Run a command…" : "Open a note…"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              runFirst();
            } else if (event.key === "Escape") {
              onClose();
            }
          }}
        />
        <ul className="palette-list">
          {results.map((result) => (
            <li key={result.key}>
              <button
                className="palette-item"
                onClick={() => {
                  result.run();
                  onClose();
                }}
              >
                {result.label}
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="palette-empty">No matches</li>}
        </ul>
      </div>
    </div>
  );
}
