import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { workspaceReducer } from "./reducer";
import { createInitialState, type ThemeMode, type WorkspaceAction, type WorkspaceState } from "./types";

interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const THEME_KEY = "notes.theme";

function loadInitialTheme(): ThemeMode {
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, loadInitialTheme(), createInitialState);
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
