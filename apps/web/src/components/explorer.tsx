import { useEffect, useState, type MouseEvent } from "react";
import { api, type FileEntry } from "../api/client";
import { useAppServices } from "../state/app-services";
import { useWorkspace } from "../state/app-context";

function iconFor(name: string): string {
  return name.toLowerCase().endsWith(".canvas") ? "🗺️" : "📄";
}

function dirOf(path: string): string {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

function baseNoExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

interface NodeHandlers {
  onOpen: (node: FileEntry) => void;
  onContextMenu: (event: MouseEvent, node: FileEntry) => void;
  onMove: (fromPath: string, toDir: string) => void;
  dragOverPath: string | null;
  setDragOverPath: (path: string | null) => void;
}

const DRAG_TYPE = "application/x-notes-path";

function ExplorerNode({
  entry,
  depth,
  handlers,
}: {
  entry: FileEntry;
  depth: number;
  handlers: NodeHandlers;
}) {
  const [open, setOpen] = useState(depth === 0);
  const indent = { paddingLeft: `${depth * 12 + 8}px` };

  if (entry.type === "directory") {
    const isDropTarget = handlers.dragOverPath === entry.path;
    return (
      <li>
        <button
          className={`tree-row tree-dir ${isDropTarget ? "tree-row--drop" : ""}`}
          style={indent}
          onClick={() => setOpen((value) => !value)}
          onContextMenu={(event) => handlers.onContextMenu(event, entry)}
          onDragOver={(event) => {
            event.preventDefault();
            handlers.setDragOverPath(entry.path);
          }}
          onDragLeave={() => handlers.setDragOverPath(null)}
          onDrop={(event) => {
            event.preventDefault();
            const from = event.dataTransfer.getData(DRAG_TYPE);
            handlers.setDragOverPath(null);
            if (from) {
              handlers.onMove(from, entry.path);
            }
          }}
        >
          <span className="tree-caret">{open ? "▾" : "▸"}</span>
          <span className="tree-name">{entry.name}</span>
        </button>
        {open && (
          <ul className="tree-children">
            {(entry.children ?? []).map((child) => (
              <ExplorerNode key={child.path} entry={child} depth={depth + 1} handlers={handlers} />
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
        draggable
        onDragStart={(event) => event.dataTransfer.setData(DRAG_TYPE, entry.path)}
        onClick={() => handlers.onOpen(entry)}
        onContextMenu={(event) => handlers.onContextMenu(event, entry)}
      >
        <span className="tree-icon">{iconFor(entry.name)}</span>
        <span className="tree-name">{entry.name}</span>
      </button>
    </li>
  );
}

interface ContextMenu {
  x: number;
  y: number;
  node?: FileEntry;
}

export function Explorer() {
  const { state, dispatch } = useWorkspace();
  const services = useAppServices();
  const [menu, setMenu] = useState<ContextMenu | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenu(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const refresh = async () => {
    const { entries } = await api.files();
    dispatch({ type: "setTree", tree: entries });
  };

  const openNode = (node: FileEntry) =>
    dispatch({ type: "openFile", path: node.path, title: baseNoExt(node.name) });

  const renameNode = async (node: FileEntry) => {
    const input = window.prompt(`Rename ${node.type}`, node.name);
    if (!input || input === node.name) {
      return;
    }
    const dir = dirOf(node.path);
    const to = dir ? `${dir}/${input}` : input;
    services.markModified(node.path);
    await api.rename(node.path, to);
    if (node.type === "file") {
      dispatch({ type: "renamePath", from: node.path, to, title: baseNoExt(input) });
    } else {
      dispatch({ type: "renamePrefix", from: node.path, to });
    }
    await refresh();
  };

  const removeNode = async (node: FileEntry) => {
    if (node.type === "file") {
      // Files use the app-level delete which offers an Undo toast.
      await services.deletePath(node.path);
      return;
    }
    if (!window.confirm(`Delete folder "${node.name}" and its contents? This cannot be undone.`)) {
      return;
    }
    await api.remove(node.path);
    dispatch({ type: "closePrefix", path: node.path });
    await refresh();
  };

  const move = async (fromPath: string, toDir: string) => {
    const base = fromPath.split("/").pop() ?? fromPath;
    const to = toDir ? `${toDir}/${base}` : base;
    if (to === fromPath) {
      return;
    }
    services.markModified(fromPath);
    await api.rename(fromPath, to);
    dispatch({ type: "renamePath", from: fromPath, to, title: baseNoExt(base) });
    await refresh();
  };

  const newFolder = async (dir: string) => {
    const input = window.prompt("New folder name");
    if (!input) {
      return;
    }
    await api.mkdir(dir ? `${dir}/${input}` : input);
    await refresh();
  };

  const openMenu = (event: MouseEvent, node?: FileEntry) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, node });
  };

  const handlers: NodeHandlers = {
    onOpen: openNode,
    onContextMenu: (event, node) => openMenu(event, node),
    onMove: move,
    dragOverPath,
    setDragOverPath,
  };

  const menuItems = (): { label: string; run: () => void; danger?: boolean }[] => {
    const node = menu?.node;
    const dir = node?.type === "directory" ? node.path : "";
    if (!node || node.type === "directory") {
      return [
        { label: "New note", run: () => services.createNote(dir) },
        { label: "New table", run: () => services.createTable(dir) },
        { label: "New canvas", run: () => services.createCanvas(dir) },
        { label: "New board", run: () => services.createBoard(dir) },
        { label: "New folder…", run: () => void newFolder(dir) },
        ...(node
          ? [
              { label: "Rename…", run: () => void renameNode(node) },
              { label: "Delete", run: () => void removeNode(node), danger: true },
            ]
          : []),
      ];
    }
    return [
      { label: "Open", run: () => openNode(node) },
      { label: "Rename…", run: () => void renameNode(node) },
      { label: "Delete", run: () => void removeNode(node), danger: true },
    ];
  };

  return (
    <div
      className="explorer"
      onContextMenu={(event) => openMenu(event)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const from = event.dataTransfer.getData(DRAG_TYPE);
        if (from) {
          void move(from, "");
        }
      }}
    >
      {state.tree.length === 0 ? (
        <div className="explorer-empty">
          <p>No notes yet.</p>
          <button className="explorer-seed" onClick={() => services.seedSampleNotes()}>
            ✨ Add sample notes
          </button>
          <p className="explorer-empty-hint">…or use “＋ New note”.</p>
        </div>
      ) : (
        <ul className="tree-root">
          {state.tree.map((entry) => (
            <ExplorerNode key={entry.path} entry={entry} depth={0} handlers={handlers} />
          ))}
        </ul>
      )}

      {menu && (
        <div
          className="context-menu"
          role="menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {menuItems().map((item) => (
            <button
              key={item.label}
              role="menuitem"
              className={`context-item ${item.danger ? "context-item--danger" : ""}`}
              onClick={() => {
                item.run();
                setMenu(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
