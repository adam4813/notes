import type { Pane, Tab, WorkspaceAction, WorkspaceState } from "./types";

function generateId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}

function updatePane(
  state: WorkspaceState,
  paneId: string,
  updater: (pane: Pane) => Pane,
): WorkspaceState {
  return { ...state, panes: state.panes.map((pane) => (pane.id === paneId ? updater(pane) : pane)) };
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "setTree":
      return { ...state, tree: action.tree };

    case "setTheme":
      return { ...state, theme: action.theme };

    case "setStatus":
      return { ...state, status: action.status };

    case "focusPane":
      return { ...state, activePaneId: action.paneId };

    case "openFile": {
      const pane = state.panes.find((p) => p.id === state.activePaneId) ?? state.panes[0];
      const existing = pane.tabs.find((tab) => tab.path === action.path);
      if (existing) {
        return updatePane(state, pane.id, (p) => ({ ...p, activeTabId: existing.id }));
      }
      const tab: Tab = { id: generateId("tab"), path: action.path, title: action.title };
      return updatePane(state, pane.id, (p) => ({
        ...p,
        tabs: [...p.tabs, tab],
        activeTabId: tab.id,
      }));
    }

    case "activateTab":
      return updatePane(state, action.paneId, (p) => ({ ...p, activeTabId: action.tabId }));

    case "closeTab": {
      const updated = updatePane(state, action.paneId, (pane) => {
        const tabs = pane.tabs.filter((tab) => tab.id !== action.tabId);
        const activeTabId =
          pane.activeTabId === action.tabId ? tabs[tabs.length - 1]?.id : pane.activeTabId;
        return { ...pane, tabs, activeTabId };
      });

      const remaining = updated.panes.filter((pane) => pane.tabs.length > 0);
      const panes = remaining.length > 0 ? remaining : [{ id: generateId("pane"), tabs: [] }];
      const activePaneId = panes.some((pane) => pane.id === updated.activePaneId)
        ? updated.activePaneId
        : panes[0].id;
      return { ...updated, panes, activePaneId };
    }

    case "splitPane": {
      if (state.panes.length >= 2) {
        return state;
      }
      const source = state.panes.find((p) => p.id === state.activePaneId) ?? state.panes[0];
      const activeTab = source.tabs.find((tab) => tab.id === source.activeTabId);
      const newPane: Pane = { id: generateId("pane"), tabs: [] };
      if (activeTab) {
        const cloned: Tab = { ...activeTab, id: generateId("tab") };
        newPane.tabs = [cloned];
        newPane.activeTabId = cloned.id;
      }
      return { ...state, panes: [...state.panes, newPane], activePaneId: newPane.id };
    }

    default:
      return state;
  }
}
