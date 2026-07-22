import { useWorkspace } from "../state/app-context";
import { DragContextProvider } from "./drag-context";
import { Pane } from "./pane";

export function Workspace() {
  const { state } = useWorkspace();
  return (
    <DragContextProvider>
      <main className="workspace" aria-label="Editor">
        {state.panes.map((pane) => (
          <Pane key={pane.id} pane={pane} />
        ))}
      </main>
    </DragContextProvider>
  );
}
