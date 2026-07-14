import { Island, IslandBody, IslandHeader } from "@notes/ui";
import { useWorkspace } from "../state/app-context";
import type { Pane as PaneModel } from "../state/types";
import { TabBar } from "./tab-bar";
import { ViewHost } from "./view-host";

export function Pane({ pane }: { pane: PaneModel }) {
  const { state, dispatch } = useWorkspace();
  const activeTab = pane.tabs.find((tab) => tab.id === pane.activeTabId);
  const isActive = state.activePaneId === pane.id;

  return (
    <Island grow active={isActive} onFocus={() => dispatch({ type: "focusPane", paneId: pane.id })}>
      <IslandHeader>
        <TabBar pane={pane} />
      </IslandHeader>
      <IslandBody>
        {activeTab ? (
          <ViewHost key={activeTab.path} path={activeTab.path} />
        ) : (
          <div className="panel-empty">
            <span>Select a note to open it here.</span>
            {state.panes.length > 1 && (
              <button
                className="btn-ghost pane-close"
                onClick={() => dispatch({ type: "closePane", paneId: pane.id })}
              >
                Close split
              </button>
            )}
          </div>
        )}
      </IslandBody>
    </Island>
  );
}
