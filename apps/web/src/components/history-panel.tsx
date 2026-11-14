import { useState } from "react";
import { PanelEmpty, PanelSection } from "@notes/ui";
import { formatRelativeTime } from "../lib/relative-time";
import { useHistoryView } from "../state/history-context";
import { useFileHistory, useSnapshot } from "../state/use-history";
import { useToasts } from "../state/toast";

/**
 * Right-panel section listing the saved versions of the active note, with a
 * control to save a new version (a git snapshot of the whole Tome). Selecting a
 * version opens it in the editor as a read-only diff.
 */
export function HistoryPanelSection({ path }: { path: string }) {
  const { data, isLoading, isError } = useFileHistory(path);
  const snapshot = useSnapshot();
  const { selection, open } = useHistoryView();
  const { notify } = useToasts();
  const [message, setMessage] = useState("");

  const saveVersion = () => {
    const text = message.trim();
    snapshot.mutate(text || undefined, {
      onSuccess: (result) => {
        setMessage("");
        notify(result.created ? "Version saved." : "No changes to save.", {
          kind: result.created ? "success" : "info",
        });
      },
      onError: () => notify("Couldn't save version.", { kind: "error" }),
    });
  };

  const versions = data?.versions ?? [];

  return (
    <PanelSection title="Version history">
      <div className="history-save">
        <input
          className="history-save-input"
          aria-label="Version description"
          placeholder="Describe this version (optional)"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              saveVersion();
            }
          }}
        />
        <button
          type="button"
          className="history-save-btn"
          onClick={saveVersion}
          disabled={snapshot.isPending}
        >
          {snapshot.isPending ? "Saving…" : "Save version"}
        </button>
      </div>

      {data?.hasUncommittedChanges && (
        <p className="history-hint">You have unsaved changes since the last version.</p>
      )}

      {isLoading && <PanelEmpty>Loading history…</PanelEmpty>}
      {isError && <PanelEmpty>Couldn&apos;t load history.</PanelEmpty>}
      {data && !isLoading && versions.length === 0 && (
        <PanelEmpty>
          {data.initialized
            ? "No versions yet. Save one to start tracking history."
            : "Save a version to start backing up and tracking history."}
        </PanelEmpty>
      )}

      {versions.length > 0 && (
        <ul className="history-list">
          {versions.map((version) => {
            const active = selection?.path === path && selection.oid === version.oid;
            return (
              <li key={version.oid}>
                <button
                  type="button"
                  className={`history-item${active ? " history-item--active" : ""}`}
                  onClick={() =>
                    open({
                      path,
                      oid: version.oid,
                      label: formatRelativeTime(version.timestamp),
                    })
                  }
                  title={new Date(version.timestamp).toLocaleString()}
                >
                  <span className="history-item-time">{formatRelativeTime(version.timestamp)}</span>
                  <span className="history-item-message">
                    {version.message || version.shortOid}
                  </span>
                  <span className="history-item-counts">
                    {version.additions > 0 && (
                      <span className="history-count history-count--add">+{version.additions}</span>
                    )}
                    {version.deletions > 0 && (
                      <span className="history-count history-count--del">−{version.deletions}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PanelSection>
  );
}
