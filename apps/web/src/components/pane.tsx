import { type DragEvent, useState } from "react";
import { Island, IslandBody, IslandHeader } from "@notes/ui";
import { useWorkspace } from "../state/app-context";
import type { Pane as PaneModel } from "../state/types";
import { useDragContext } from "./drag-context";
import { TabBar } from "./tab-bar";
import { ViewHost } from "./view-host";

export function Pane({ pane }: { pane: PaneModel }) {
  const { state, dispatch } = useWorkspace();
  const { draggedTab } = useDragContext();
  const [edgeDragSide, setEdgeDragSide] = useState<"left" | "right" | null>(null);

  const activeTab = pane.tabs.find((tab) => tab.id === pane.activeTabId);
  const isActive = state.activePaneId === pane.id;

  // Edge drop zones appear when exactly one pane is open and the dragged tab
  // is not the only tab in the pane (splitting would leave at least one tab).
  const showEdgeZones = draggedTab !== null && state.panes.length === 1 && pane.tabs.length > 1;

  const handleEdgeDrop = (e: DragEvent, insertBefore: boolean) => {
    e.preventDefault();
    if (!draggedTab) return;
    dispatch({
      type: "splitPane",
      paneId: draggedTab.paneId,
      mode: "move",
      tabId: draggedTab.tabId,
      insertBefore,
    });
    setEdgeDragSide(null);
  };

  return (
    <div className={`pane-wrapper${showEdgeZones ? " pane-wrapper--dragging" : ""}`}>
      {showEdgeZones && (
        <div
          className={`pane-edge-zone pane-edge-zone--left${edgeDragSide === "left" ? " pane-edge-zone--active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setEdgeDragSide("left");
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setEdgeDragSide(null);
            }
          }}
          onDrop={(e) => handleEdgeDrop(e, true)}
        />
      )}

      <Island
        grow
        active={isActive}
        onFocus={() => dispatch({ type: "focusPane", paneId: pane.id })}
      >
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

      {showEdgeZones && (
        <div
          className={`pane-edge-zone pane-edge-zone--right${edgeDragSide === "right" ? " pane-edge-zone--active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setEdgeDragSide("right");
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setEdgeDragSide(null);
            }
          }}
          onDrop={(e) => handleEdgeDrop(e, false)}
        />
      )}
    </div>
  );
}
