import { useEffect, useState } from "react";
import { api, type Backlink } from "../api/client";
import { useWorkspace } from "../state/app-context";

export function RightPanel() {
  const { state, dispatch } = useWorkspace();
  const activePane = state.panes.find((pane) => pane.id === state.activePaneId) ?? state.panes[0];
  const activeTab = activePane?.tabs.find((tab) => tab.id === activePane.activeTabId);
  const path = activeTab?.path;
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);

  useEffect(() => {
    if (!path) {
      setBacklinks([]);
      return;
    }
    let cancelled = false;
    api
      .backlinks(path)
      .then((result) => {
        if (!cancelled) {
          setBacklinks(result.backlinks);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBacklinks([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <aside className="right-panel">
      <div className="panel-header">Backlinks</div>
      {!path && <div className="panel-empty">Open a note to see backlinks.</div>}
      {path && backlinks.length === 0 && <div className="panel-empty">No backlinks yet.</div>}
      <ul className="backlink-list">
        {backlinks.map((backlink) => (
          <li key={backlink.path}>
            <button
              className="backlink"
              onClick={() =>
                dispatch({ type: "openFile", path: backlink.path, title: backlink.title })
              }
            >
              {backlink.title}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
