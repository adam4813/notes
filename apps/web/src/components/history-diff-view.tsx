import { useState } from "react";
import { PanelEmpty } from "@notes/ui";
import { formatRelativeTime } from "../lib/relative-time";
import { useVersionDiff } from "../state/use-history";

const SIGN: Record<string, string> = { add: "+", del: "−", context: "\u00a0" };

interface HistoryDiffViewProps {
  path: string;
  oid: string;
  onClose: () => void;
  onRestore: (content: string) => Promise<void> | void;
}

/**
 * Read-only, Google-Docs-style view of a single saved version: a banner with
 * the version's date/message plus a line-by-line diff of what that version
 * changed. Replaces the editor body while a version is selected.
 */
export function HistoryDiffView({ path, oid, onClose, onRestore }: HistoryDiffViewProps) {
  const { data, isLoading, isError } = useVersionDiff(path, oid);
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    if (!data) {
      return;
    }
    setRestoring(true);
    try {
      await onRestore(data.content);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="note-editor history-diff">
      <div className="history-diff-banner">
        <div className="history-diff-info">
          <span className="history-diff-title">Viewing an earlier version</span>
          {data && (
            <span className="history-diff-meta" title={new Date(data.timestamp).toLocaleString()}>
              {formatRelativeTime(data.timestamp)}
              {data.message ? ` · ${data.message}` : ""}
              {data.author ? ` · ${data.author}` : ""}
            </span>
          )}
        </div>
        <div className="history-diff-actions">
          <button
            type="button"
            className="history-btn history-btn--primary"
            onClick={() => void handleRestore()}
            disabled={!data || restoring}
          >
            {restoring ? "Restoring…" : "Restore this version"}
          </button>
          <button type="button" className="history-btn" onClick={onClose}>
            Back to current
          </button>
        </div>
      </div>

      <div className="history-diff-body">
        {isLoading && <PanelEmpty>Loading version…</PanelEmpty>}
        {isError && <PanelEmpty>Couldn&apos;t load this version.</PanelEmpty>}
        {data && data.rows.length === 0 && <PanelEmpty>This version is empty.</PanelEmpty>}
        {data && data.rows.length > 0 && (
          <div className="history-diff-rows" role="list" aria-label="Version differences">
            {data.rows.map((row, index) => (
              <div
                key={index}
                role="listitem"
                className={`history-diff-row history-diff-row--${row.type}`}
              >
                <span className="history-diff-gutter" aria-hidden>
                  {row.oldLine ?? ""}
                </span>
                <span className="history-diff-gutter" aria-hidden>
                  {row.newLine ?? ""}
                </span>
                <span className="history-diff-sign" aria-hidden>
                  {SIGN[row.type]}
                </span>
                <span className="history-diff-text">{row.text === "" ? "\u00a0" : row.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
