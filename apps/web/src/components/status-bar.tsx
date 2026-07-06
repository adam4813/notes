import { useWorkspace } from "../state/app-context";
import { flattenFiles } from "../state/selectors";

export function StatusBar() {
  const { state } = useWorkspace();
  const noteCount = flattenFiles(state.tree).length;
  const activePane = state.panes.find((pane) => pane.id === state.activePaneId);
  const activeTab = activePane?.tabs.find((tab) => tab.id === activePane.activeTabId);

  return (
    <footer className="status-bar">
      <span>{noteCount} notes</span>
      <span className="status-message">{state.status}</span>
      <span className="status-path">{activeTab?.path ?? "—"}</span>
    </footer>
  );
}
