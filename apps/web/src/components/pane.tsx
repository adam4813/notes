import { useWorkspace } from "../state/app-context";
import type { Pane as PaneModel } from "../state/types";
import { TabBar } from "./tab-bar";
import { ViewHost } from "./view-host";

export function Pane({ pane }: { pane: PaneModel }) {
  const { state, dispatch } = useWorkspace();
  const activeTab = pane.tabs.find((tab) => tab.id === pane.activeTabId);
  const isActive = state.activePaneId === pane.id;

  return (
    <section
      className={`pane ${isActive ? "pane--active" : ""}`}
      onMouseDown={() => dispatch({ type: "focusPane", paneId: pane.id })}
    >
      <TabBar pane={pane} />
      <div className="pane-body">
        {activeTab ? (
          <ViewHost path={activeTab.path} />
        ) : (
          <div className="pane-empty">
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
      </div>
    </section>
  );
}
