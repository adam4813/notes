import { useWorkspace } from "../state/app-context";
import { Pane } from "./pane";

export function Workspace() {
  const { state } = useWorkspace();
  return (
    <div className="workspace">
      {state.panes.map((pane) => (
        <Pane key={pane.id} pane={pane} />
      ))}
    </div>
  );
}
