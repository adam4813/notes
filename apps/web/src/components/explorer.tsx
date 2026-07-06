import { useState } from "react";
import type { FileEntry } from "../api/client";
import { useWorkspace } from "../state/app-context";

function iconFor(name: string): string {
  return name.toLowerCase().endsWith(".canvas") ? "🗺️" : "📄";
}

function ExplorerNode({ entry, depth }: { entry: FileEntry; depth: number }) {
  const { dispatch } = useWorkspace();
  const [open, setOpen] = useState(depth === 0);
  const indent = { paddingLeft: `${depth * 12 + 8}px` };

  if (entry.type === "directory") {
    return (
      <li>
        <button className="tree-row tree-dir" style={indent} onClick={() => setOpen((value) => !value)}>
          <span className="tree-caret">{open ? "▾" : "▸"}</span>
          <span className="tree-name">{entry.name}</span>
        </button>
        {open && (
          <ul className="tree-children">
            {(entry.children ?? []).map((child) => (
              <ExplorerNode key={child.path} entry={child} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <button
        className="tree-row tree-file"
        style={indent}
        title={entry.path}
        onClick={() =>
          dispatch({
            type: "openFile",
            path: entry.path,
            title: entry.name.replace(/\.[^.]+$/, ""),
          })
        }
      >
        <span className="tree-icon">{iconFor(entry.name)}</span>
        <span className="tree-name">{entry.name}</span>
      </button>
    </li>
  );
}

export function Explorer() {
  const { state } = useWorkspace();
  if (state.tree.length === 0) {
    return <div className="explorer-empty">No notes yet. Create one with “＋ New note”.</div>;
  }
  return (
    <ul className="tree-root">
      {state.tree.map((entry) => (
        <ExplorerNode key={entry.path} entry={entry} depth={0} />
      ))}
    </ul>
  );
}
