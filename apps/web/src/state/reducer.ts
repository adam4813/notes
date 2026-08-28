import type { NavEntry, Pane, Tab, WorkspaceAction, WorkspaceState } from "./types";

/** Maximum number of entries kept in the navigation history. */
const NAV_MAX = 100;

function generateId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}

function updatePane(
  state: WorkspaceState,
  paneId: string,
  updater: (pane: Pane) => Pane,
): WorkspaceState {
  return {
    ...state,
    panes: state.panes.map((pane) => (pane.id === paneId ? updater(pane) : pane)),
  };
}

/**
 * Push `entry` to the navigation history of `state`, truncating any forward
 * entries, and return the updated nav fields.  Returns undefined when the entry
 * is identical to the current position (no-op).
 */
function pushNav(
  state: WorkspaceState,
  entry: NavEntry,
): Pick<WorkspaceState, "navHistory" | "navIndex"> | undefined {
  const current = state.navHistory[state.navIndex];
  if (current && current.path === entry.path) {
    // Already at this location — update title in place if it changed.
    if (current.title === entry.title) return undefined;
    const navHistory = [...state.navHistory];
    navHistory[state.navIndex] = entry;
    return { navHistory, navIndex: state.navIndex };
  }
  // Truncate any forward entries and append the new one.
  const base = state.navHistory.slice(0, state.navIndex + 1);
  const navHistory = [...base, entry].slice(-NAV_MAX);
  return { navHistory, navIndex: navHistory.length - 1 };
}

/**
 * Resolve the pane state when navigating to `entry` without pushing history.
 * Activates an existing tab for the path, or opens a new tab.
 */
function applyNavEntry(state: WorkspaceState, entry: NavEntry): WorkspaceState {
  // Find the pane that currently has this path open.
  for (const pane of state.panes) {
    const tab = pane.tabs.find((t) => t.path === entry.path);
    if (tab) {
      const next = updatePane(state, pane.id, (p) => ({ ...p, activeTabId: tab.id }));
      return { ...next, activePaneId: pane.id };
    }
  }
  // Not open anywhere — open it as a new tab in the active pane.
  const pane = state.panes.find((p) => p.id === state.activePaneId) ?? state.panes[0];
  const tab: Tab = { id: generateId("tab"), path: entry.path, title: entry.title };
  return updatePane(state, pane.id, (p) => ({
    ...p,
    tabs: [...p.tabs, tab],
    activeTabId: tab.id,
  }));
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
      const navUpdate = pushNav(state, { path: action.path, title: action.title });
      if (existing) {
        const next = updatePane(state, pane.id, (p) => ({ ...p, activeTabId: existing.id }));
        return navUpdate ? { ...next, ...navUpdate } : next;
      }
      const tab: Tab = { id: generateId("tab"), path: action.path, title: action.title };
      const next = updatePane(state, pane.id, (p) => ({
        ...p,
        tabs: [...p.tabs, tab],
        activeTabId: tab.id,
      }));
      return navUpdate ? { ...next, ...navUpdate } : next;
    }

    case "navBack": {
      if (state.navIndex <= 0) return state;
      const navIndex = state.navIndex - 1;
      const entry = state.navHistory[navIndex];
      if (!entry) return state;
      const next = applyNavEntry(state, entry);
      return { ...next, navIndex };
    }

    case "navForward": {
      if (state.navIndex >= state.navHistory.length - 1) return state;
      const navIndex = state.navIndex + 1;
      const entry = state.navHistory[navIndex];
      if (!entry) return state;
      const next = applyNavEntry(state, entry);
      return { ...next, navIndex };
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
      // If a specific tabId is provided, use that tab; otherwise fall back to the active tab.
      const activeTab = action.tabId
        ? source.tabs.find((tab) => tab.id === action.tabId)
        : source.tabs.find((tab) => tab.id === source.activeTabId);

      const newPane: Pane = { id: generateId("pane"), tabs: [] };
      if (activeTab) {
        const cloned: Tab = { ...activeTab, id: generateId("tab") };
        newPane.tabs = [cloned];
        newPane.activeTabId = cloned.id;
      }

      let sourcePanes = [...state.panes];
      if (action.mode === "move" && activeTab) {
        sourcePanes = sourcePanes.map((pane) => {
          if (pane.id !== source.id) {
            return pane;
          }
          const tabs = pane.tabs.filter((tab) => tab.id !== activeTab.id);
          return { ...pane, tabs, activeTabId: tabs[tabs.length - 1]?.id };
        });
      }

      // Insert new pane immediately before or after the source pane.
      const sourceIdx = sourcePanes.findIndex((p) => p.id === source.id);
      const insertAt = action.insertBefore ? sourceIdx : sourceIdx + 1;
      const panes = [...sourcePanes.slice(0, insertAt), newPane, ...sourcePanes.slice(insertAt)];
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

    case "moveTab": {
      const { fromPaneId, tabId, toPaneId, toIndex } = action;
      const sourcePane = state.panes.find((p) => p.id === fromPaneId);
      if (!sourcePane) return state;
      const tab = sourcePane.tabs.find((t) => t.id === tabId);
      if (!tab) return state;

      if (fromPaneId === toPaneId) {
        // Reorder within the same pane.
        return updatePane(state, fromPaneId, (pane) => {
          const fromIndex = pane.tabs.findIndex((t) => t.id === tabId);
          if (fromIndex === -1) return pane;
          const tabs = [...pane.tabs];
          tabs.splice(fromIndex, 1);
          // After removing the dragged tab, all indices after it shift left by 1.
          // Compensate only when the insertion point was to the right of the source.
          const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
          tabs.splice(Math.min(insertAt, tabs.length), 0, tab);
          return { ...pane, tabs, activeTabId: tab.id };
        });
      }

      // Move between panes.
      const targetPane = state.panes.find((p) => p.id === toPaneId);
      if (!targetPane) return state;

      const panes = state.panes.map((pane) => {
        if (pane.id === fromPaneId) {
          const tabs = pane.tabs.filter((t) => t.id !== tabId);
          const activeTabId =
            pane.activeTabId === tabId ? tabs[tabs.length - 1]?.id : pane.activeTabId;
          return { ...pane, tabs, activeTabId };
        }
        if (pane.id === toPaneId) {
          // If the target pane already has the same path open, activate it.
          const existing = pane.tabs.find((t) => t.path === tab.path);
          if (existing) {
            return { ...pane, activeTabId: existing.id };
          }
          const moved: Tab = { ...tab, id: generateId("tab") };
          const tabs = [...pane.tabs];
          tabs.splice(Math.min(toIndex, tabs.length), 0, moved);
          return { ...pane, tabs, activeTabId: moved.id };
        }
        return pane;
      });

      const remaining = panes.filter((pane) => pane.tabs.length > 0);
      const finalPanes = remaining.length > 0 ? remaining : [{ id: generateId("pane"), tabs: [] }];
      const activePaneId = finalPanes.some((pane) => pane.id === toPaneId)
        ? toPaneId
        : finalPanes[0].id;
      return { ...state, panes: finalPanes, activePaneId };
    }

    default:
      return state;
  }
}
