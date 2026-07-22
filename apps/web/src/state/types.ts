import type { FileEntry } from "../api/client";

/**
 * Theme identifier. Built-in values: "light" | "dark" | "system" | "solarized" | "contrast".
 * User-installed themes add their own id strings (e.g. "win98").
 */
export type ThemeMode = string;

export interface Tab {
  id: string;
  path: string;
  title: string;
}

export interface Pane {
  id: string;
  tabs: Tab[];
  activeTabId?: string;
}

export interface WorkspaceState {
  tree: FileEntry[];
  panes: Pane[];
  activePaneId: string;
  theme: ThemeMode;
  status: string;
}

export type WorkspaceAction =
  | { type: "setTree"; tree: FileEntry[] }
  | { type: "openFile"; path: string; title: string }
  | { type: "closeTab"; paneId: string; tabId: string }
  | { type: "closeOtherTabs"; paneId: string; tabId: string }
  | { type: "closeTabsToRight"; paneId: string; tabId: string }
  | { type: "closeTabsToLeft"; paneId: string; tabId: string }
  | { type: "closeAllTabs"; paneId: string }
  | { type: "activateTab"; paneId: string; tabId: string }
  | { type: "focusPane"; paneId: string }
  | {
      type: "splitPane";
      paneId: string;
      mode: "duplicate" | "move";
      /** If provided, move this specific tab instead of the active tab */
      tabId?: string;
      /** If true, insert the new pane before (left of) the source pane */
      insertBefore?: boolean;
    }
  | { type: "closePane"; paneId: string }
  | { type: "moveTabToOpposite"; paneId: string }
  | {
      type: "moveTab";
      fromPaneId: string;
      tabId: string;
      toPaneId: string;
      /** Index in the target pane's tab array where the tab should be inserted */
      toIndex: number;
    }
  | { type: "renamePath"; from: string; to: string; title: string }
  | { type: "renamePrefix"; from: string; to: string }
  | { type: "closePath"; path: string }
  | { type: "closePrefix"; path: string }
  | { type: "setTheme"; theme: ThemeMode }
  | { type: "setStatus"; status: string };

export function createInitialState(theme: ThemeMode): WorkspaceState {
  const paneId = "pane-root";
  return {
    tree: [],
    panes: [{ id: paneId, tabs: [] }],
    activePaneId: paneId,
    theme,
    status: "Ready",
  };
}
