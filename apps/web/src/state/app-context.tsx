import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from "react";
import { workspaceReducer } from "./reducer";
import {
  createInitialState,
  type Pane,
  type ThemeMode,
  type WorkspaceAction,
  type WorkspaceState,
} from "./types";

interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const THEME_KEY = "notes.theme";
const LAYOUT_KEY = "notes.layout";

function loadInitialTheme(): ThemeMode {
  const stored = window.localStorage.getItem(THEME_KEY);
  if (!stored) return "system";
  // Accept any non-empty string — external theme ids are valid too.
  return stored.length > 0 ? stored : "system";
}

interface PersistedLayout {
  panes: Pane[];
  activePaneId: string;
}

/** Reads and validates the persisted tab/pane layout, or null if unusable. */
function loadLayout(): PersistedLayout | null {
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedLayout;
    if (!Array.isArray(parsed.panes) || parsed.panes.length === 0) {
      return null;
    }
    const panes = parsed.panes
      .filter((pane) => pane && typeof pane.id === "string" && Array.isArray(pane.tabs))
      .map((pane) => ({
        id: pane.id,
        activeTabId: pane.activeTabId,
        tabs: pane.tabs.filter(
          (tab) => tab && typeof tab.id === "string" && typeof tab.path === "string",
        ),
      }));
    if (panes.length === 0) {
      return null;
    }
    const activePaneId = panes.some((pane) => pane.id === parsed.activePaneId)
      ? parsed.activePaneId
      : panes[0].id;
    return { panes, activePaneId };
  } catch {
    return null;
  }
}

function saveLayout(state: WorkspaceState): void {
  const layout: PersistedLayout = { panes: state.panes, activePaneId: state.activePaneId };
  try {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // ignore storage quota/access errors
  }
}

function initState(theme: ThemeMode): WorkspaceState {
  const base = createInitialState(theme);
  const layout = loadLayout();
  return layout ? { ...base, panes: layout.panes, activePaneId: layout.activePaneId } : base;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, loadInitialTheme(), initState);

  useEffect(() => {
    saveLayout(state);
  }, [state.panes, state.activePaneId]);

  return (
    <WorkspaceContext.Provider value={{ state, dispatch }}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
