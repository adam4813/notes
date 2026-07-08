import { useWorkspace } from "../state/app-context";
import { Pane } from "./pane";

export function Workspace() {
  const { state } = useWorkspace();
  return (
    <main className="workspace" aria-label="Editor">
      {state.panes.map((pane) => (
        <Pane key={pane.id} pane={pane} />
      ))}
    </main>
  );
}
