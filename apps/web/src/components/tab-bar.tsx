import type { MouseEvent } from "react";
import { useWorkspace } from "../state/app-context";
import type { Pane } from "../state/types";

export function TabBar({ pane }: { pane: Pane }) {
  const { dispatch } = useWorkspace();

  const close = (event: MouseEvent, tabId: string) => {
    event.stopPropagation();
    dispatch({ type: "closeTab", paneId: pane.id, tabId });
  };

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {pane.tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === pane.activeTabId ? "tab--active" : ""}`}
            onClick={() => dispatch({ type: "activateTab", paneId: pane.id, tabId: tab.id })}
          >
            <span className="tab-title">{tab.title}</span>
            <button className="tab-close" title="Close" onClick={(event) => close(event, tab.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="tab-split" title="Split pane" onClick={() => dispatch({ type: "splitPane" })}>
        ⫿
      </button>
    </div>
  );
}
