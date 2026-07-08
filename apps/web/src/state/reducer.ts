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

    case "renamePath":
      return {
        ...state,
        panes: state.panes.map((pane) => ({
          ...pane,
          tabs: pane.tabs.map((tab) =>
            tab.path === action.from ? { ...tab, path: action.to, title: action.title } : tab,
          ),
        })),
      };

    case "renamePrefix": {
      const prefix = `${action.from}/`;
      return {
        ...state,
        panes: state.panes.map((pane) => ({
          ...pane,
          tabs: pane.tabs.map((tab) =>
            tab.path.startsWith(prefix)
              ? { ...tab, path: `${action.to}/${tab.path.slice(prefix.length)}` }
              : tab,
          ),
        })),
      };
    }

    case "closePath":
    case "closePrefix": {
      const matches = (path: string) =>
        action.type === "closePath" ? path === action.path : path.startsWith(`${action.path}/`);
      const panes = state.panes
        .map((pane) => {
          const tabs = pane.tabs.filter((tab) => !matches(tab.path));
          const activeStillOpen = tabs.some((tab) => tab.id === pane.activeTabId);
          return {
            ...pane,
            tabs,
            activeTabId: activeStillOpen ? pane.activeTabId : tabs[tabs.length - 1]?.id,
          };
        })
        .filter((pane) => pane.tabs.length > 0);
      const finalPanes = panes.length > 0 ? panes : [{ id: generateId("pane"), tabs: [] }];
      const activePaneId = finalPanes.some((pane) => pane.id === state.activePaneId)
        ? state.activePaneId
        : finalPanes[0].id;
      return { ...state, panes: finalPanes, activePaneId };
    }

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

    case "closeOtherTabs":
    case "closeTabsToRight":
    case "closeTabsToLeft":
    case "closeAllTabs": {
      const keep = (pane: Pane): Tab[] => {
        if (action.type === "closeAllTabs") {
          return [];
        }
        const anchorIndex = pane.tabs.findIndex((tab) => tab.id === action.tabId);
        if (anchorIndex === -1) {
          return pane.tabs;
        }
        if (action.type === "closeOtherTabs") {
          return pane.tabs.filter((tab) => tab.id === action.tabId);
        }
        if (action.type === "closeTabsToRight") {
          return pane.tabs.filter((_, index) => index <= anchorIndex);
        }
        return pane.tabs.filter((_, index) => index >= anchorIndex);
      };

      const updated = updatePane(state, action.paneId, (pane) => {
        const tabs = keep(pane);
        const activeStillOpen = tabs.some((tab) => tab.id === pane.activeTabId);
        const anchorKept = tabs.some((tab) => tab.id === (action as { tabId?: string }).tabId);
        return {
          ...pane,
          tabs,
          activeTabId: activeStillOpen
            ? pane.activeTabId
            : anchorKept
              ? (action as { tabId?: string }).tabId
              : tabs[tabs.length - 1]?.id,
        };
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
      const source = state.panes.find((p) => p.id === action.paneId) ?? state.panes[0];
      const activeTab = source.tabs.find((tab) => tab.id === source.activeTabId);

      const newPane: Pane = { id: generateId("pane"), tabs: [] };
      if (activeTab) {
        const cloned: Tab = { ...activeTab, id: generateId("tab") };
        newPane.tabs = [cloned];
        newPane.activeTabId = cloned.id;
      }

      let panes = [...state.panes, newPane];
      if (action.mode === "move" && activeTab) {
        panes = panes.map((pane) => {
          if (pane.id !== source.id) {
            return pane;
          }
          const tabs = pane.tabs.filter((tab) => tab.id !== activeTab.id);
          return { ...pane, tabs, activeTabId: tabs[tabs.length - 1]?.id };
        });
      }
      return { ...state, panes, activePaneId: newPane.id };
    }

    case "closePane": {
      if (state.panes.length <= 1) {
        return state;
      }
      const panes = state.panes.filter((pane) => pane.id !== action.paneId);
      const activePaneId = panes.some((pane) => pane.id === state.activePaneId)
        ? state.activePaneId
        : panes[0].id;
      return { ...state, panes, activePaneId };
    }

    case "moveTabToOpposite": {
      if (state.panes.length < 2) {
        return state;
      }
      const source = state.panes.find((p) => p.id === action.paneId);
      const target = state.panes.find((p) => p.id !== action.paneId);
      const activeTab = source?.tabs.find((tab) => tab.id === source.activeTabId);
      if (!source || !target || !activeTab) {
        return state;
      }

      const panes = state.panes.map((pane) => {
        if (pane.id === source.id) {
          const tabs = pane.tabs.filter((tab) => tab.id !== activeTab.id);
          return { ...pane, tabs, activeTabId: tabs[tabs.length - 1]?.id };
        }
        if (pane.id === target.id) {
          const existing = pane.tabs.find((tab) => tab.path === activeTab.path);
          if (existing) {
            return { ...pane, activeTabId: existing.id };
          }
          const moved: Tab = { ...activeTab, id: generateId("tab") };
          return { ...pane, tabs: [...pane.tabs, moved], activeTabId: moved.id };
        }
        return pane;
      });

      const remaining = panes.filter((pane) => pane.tabs.length > 0);
      const finalPanes = remaining.length > 0 ? remaining : [{ id: generateId("pane"), tabs: [] }];
      const activePaneId = finalPanes.some((pane) => pane.id === target.id)
        ? target.id
        : finalPanes[0].id;
      return { ...state, panes: finalPanes, activePaneId };
    }

    default:
      return state;
  }
}
