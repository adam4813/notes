import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { findMatches, replaceAll } from "../lib/find";
import { useToasts } from "../state/toast";

interface TomeReplaceProps {
  onClose: () => void;
  onChanged: () => void;
}

interface Hit {
  path: string;
  count: number;
}

/** Project-wide find & replace across every note in the Tome. */
export function TomeReplace({ onClose, onChanged }: TomeReplaceProps) {
  const { notify } = useToasts();
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);

  const runFind = useCallback(async () => {
    const needle = find;
    if (needle.trim().length === 0) {
      setHits([]);
      return;
    }
    // Enumerate all indexed notes and count exact substring matches.
    let notes: { path: string }[] = [];
    try {
      notes = (await api.notes()).notes;
    } catch {
      notes = [];
    }
    const found: Hit[] = [];
    for (const note of notes) {
      try {
        const { content } = await api.read(note.path);
        const count = findMatches(content, needle, { caseSensitive }).length;
        if (count > 0) {
          found.push({ path: note.path, count });
        }
      } catch {
        // skip unreadable notes
      }
    }
    setHits(found);
  }, [find, caseSensitive]);

  useEffect(() => {
    const handle = setTimeout(() => void runFind(), 250);
    return () => clearTimeout(handle);
  }, [runFind]);

  const total = hits.reduce((sum, hit) => sum + hit.count, 0);

  const runReplaceAll = async () => {
    if (find.trim().length === 0 || hits.length === 0 || busy) {
      return;
    }
    setBusy(true);
    let notes = 0;
    let occurrences = 0;
    for (const hit of hits) {
      try {
        const { content } = await api.read(hit.path);
        const next = replaceAll(content, find, replace, { caseSensitive });
        if (next !== content) {
          await api.write(hit.path, next);
          notes += 1;
          occurrences += hit.count;
        }
      } catch {
        // skip notes that fail to read/write
      }
    }
    setBusy(false);
    notify(`Replaced ${occurrences} occurrence(s) in ${notes} note(s)`, { kind: "success" });
    onChanged();
    setHits([]);
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Find &amp; replace in Tome</h2>
          <button className="btn-ghost" aria-label="Close find and replace" onClick={onClose}>
            ×
          </button>
        </div>
        <section className="settings-section">
          <div className="tome-replace-fields">
            <input
              className="find-input"
              data-testid="tome-find"
              placeholder="Find in all notes"
              value={find}
              onChange={(event) => setFind(event.target.value)}
            />
            <input
              className="find-input"
              data-testid="tome-replace"
              placeholder="Replace with"
              value={replace}
              onChange={(event) => setReplace(event.target.value)}
            />
            <label className="switch">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(event) => setCaseSensitive(event.target.checked)}
              />
              <span>Case sensitive</span>
            </label>
          </div>

          <div className="tome-replace-summary" data-testid="tome-replace-summary">
            {find.trim().length === 0
              ? "Type something to find."
              : `${total} match(es) in ${hits.length} note(s)`}
          </div>
          <ul className="tome-replace-hits">
            {hits.map((hit) => (
              <li key={hit.path} className="tome-replace-hit">
                <span className="tome-replace-path">{hit.path}</span>
                <span className="tome-replace-count">{hit.count}</span>
              </li>
            ))}
          </ul>

          <button
            className="tome-replace-run"
            data-testid="tome-replace-run"
            disabled={busy || hits.length === 0}
            onClick={() => void runReplaceAll()}
          >
            {busy ? "Replacing…" : `Replace all (${total})`}
          </button>
        </section>
      </div>
    </div>
  );
}
