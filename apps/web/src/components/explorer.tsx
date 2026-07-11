import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { usePromptDialog } from "@notes/editor";
import { api, type FileEntry } from "../api/client";
import { fitMenuToViewport } from "../lib/context-menu";
import { useAppServices } from "../state/app-services";
import { useWorkspace } from "../state/app-context";
import { useToasts } from "../state/toast";
import { useVirtual } from "../lib/use-virtual";

const ROW_HEIGHT = 28;

function iconFor(name: string): string {
  return name.toLowerCase().endsWith(".canvas") ? "🗺️" : "📄";
}

function dirOf(path: string): string {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

function baseNoExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function splitName(name: string): { stem: string; ext: string } {
  if (name.startsWith(".") && name.indexOf(".", 1) === -1) {
    return { stem: name, ext: "" };
  }
  const index = name.lastIndexOf(".");
  if (index <= 0) {
    return { stem: name, ext: "" };
  }
  return { stem: name.slice(0, index), ext: name.slice(index) };
}

/** Depth-first lookup of a tree entry by path. */
function findEntry(tree: FileEntry[], path: string): FileEntry | undefined {
  for (const entry of tree) {
    if (entry.path === path) {
      return entry;
    }
    const found = entry.children && findEntry(entry.children, path);
    if (found) {
      return found;
    }
  }
  return undefined;
}

interface NodeHandlers {
  onOpen: (node: FileEntry) => void;
  onToggleDir: (path: string) => void;
  onContextMenu: (event: MouseEvent, node: FileEntry) => void;
  onMove: (fromPath: string, toDir: string) => void;
  onBeginRename: (node: FileEntry) => void;
  dragOverPath: string | null;
  setDragOverPath: (path: string | null) => void;
  typeOf: (path: string) => string | undefined;
  isOpen: (path: string) => boolean;
  renamePath: string | null;
  renameDraft: string;
  onRenameDraftChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
}

const DRAG_TYPE = "application/x-notes-path";

const TYPE_LABEL: Record<string, string> = {
  table: "Table",
  board: "Board",
  canvas: "Canvas",
  mermaid: "Diagram",
  calendar: "Calendar",
  grid: "Grid",
};

interface FlatRow {
  entry: FileEntry;
  depth: number;
}

/** Flattens the visible tree (respecting expanded dirs) for windowing. */
function flattenVisible(
  entries: FileEntry[],
  depth: number,
  isOpen: (p: string) => boolean,
  out: FlatRow[],
): void {
  for (const entry of entries) {
    out.push({ entry, depth });
    if (entry.type === "directory" && isOpen(entry.path)) {
      flattenVisible(entry.children ?? [], depth + 1, isOpen, out);
    }
  }
}

function TreeRow({
  entry,
  depth,
  handlers,
}: {
  entry: FileEntry;
  depth: number;
  handlers: NodeHandlers;
}) {
  const indent = { paddingLeft: `${depth * 12 + 8}px`, height: `${ROW_HEIGHT}px` };
  const isRenaming = handlers.renamePath === entry.path;

  if (entry.type === "directory") {
    const isDropTarget = handlers.dragOverPath === entry.path;
    if (isRenaming) {
      return (
        <div className="tree-row tree-row--rename" style={indent}>
          <span className="tree-caret">{handlers.isOpen(entry.path) ? "▾" : "▸"}</span>
          <span className="tree-icon">📁</span>
          <input
            className="tree-rename-input"
            value={handlers.renameDraft}
            autoFocus
            onChange={(event) => handlers.onRenameDraftChange(event.target.value)}
            onBlur={() => handlers.onRenameCommit()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handlers.onRenameCommit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                handlers.onRenameCancel();
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </div>
      );
    }
    return (
      <button
        className={`tree-row tree-dir ${isDropTarget ? "tree-row--drop" : ""}`}
        style={indent}
        draggable
        onDragStart={(event) => event.dataTransfer.setData(DRAG_TYPE, entry.path)}
        onClick={() => handlers.onToggleDir(entry.path)}
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
        <span className="tree-caret">{handlers.isOpen(entry.path) ? "▾" : "▸"}</span>
        <span className="tree-name">{entry.name}</span>
      </button>
    );
  }

  const noteType = entry.name.toLowerCase().endsWith(".canvas")
    ? "canvas"
    : handlers.typeOf(entry.path);
  const typeLabel = noteType ? TYPE_LABEL[noteType] : undefined;

  if (isRenaming) {
    return (
      <div className="tree-row tree-row--rename" style={indent}>
        <span className="tree-icon">{iconFor(entry.name)}</span>
        <input
          className="tree-rename-input"
          value={handlers.renameDraft}
          autoFocus
          onChange={(event) => handlers.onRenameDraftChange(event.target.value)}
          onBlur={() => handlers.onRenameCommit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handlers.onRenameCommit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              handlers.onRenameCancel();
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
        />
        {typeLabel && <span className="tree-type">[{typeLabel}]</span>}
      </div>
    );
  }

  return (
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
      {typeLabel && <span className="tree-type">[{typeLabel}]</span>}
    </button>
  );
}

interface ContextMenu {
  x: number;
  y: number;
  node?: FileEntry;
}

export function Explorer({
  renameRequestPath,
  onRenameRequestHandled,
}: {
  renameRequestPath: string | null;
  onRenameRequestHandled: () => void;
}) {
  const { openPrompt, promptDialog } = usePromptDialog();
  const { state, dispatch } = useWorkspace();
  const services = useAppServices();
  const { notify } = useToasts();
  const [menu, setMenu] = useState<ContextMenu | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());
  const [renamePath, setRenamePath] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameExt, setRenameExt] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Open all top-level directories the first time the tree loads.
  const seededOpen = useRef(false);
  useEffect(() => {
    if (!seededOpen.current && state.tree.length > 0) {
      seededOpen.current = true;
      setOpenDirs(
        new Set(
          state.tree.filter((entry) => entry.type === "directory").map((entry) => entry.path),
        ),
      );
    }
  }, [state.tree]);

  const isOpen = (path: string) => openDirs.has(path);
  const toggleDir = (path: string) =>
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });

  const openAncestors = (path: string) => {
    setOpenDirs((prev) => {
      const next = new Set(prev);
      let current = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      while (current) {
        next.add(current);
        current = current.includes("/") ? current.slice(0, current.lastIndexOf("/")) : "";
      }
      return next;
    });
  };

  const beginRename = (node: FileEntry) => {
    setMenu(null);
    setRenamePath(node.path);
    const { stem, ext } =
      node.type === "file" ? splitName(node.name) : { stem: node.name, ext: "" };
    setRenameDraft(stem);
    setRenameExt(ext);
    openAncestors(node.path);
    if (node.type === "directory") {
      setOpenDirs((prev) => {
        const next = new Set(prev);
        next.add(node.path);
        return next;
      });
    }
  };

  const cancelRename = () => {
    setRenamePath(null);
    setRenameDraft("");
    setRenameExt("");
  };

  const commitRename = async () => {
    if (!renamePath) {
      return;
    }
    const node = findEntry(state.tree, renamePath);
    if (!node) {
      cancelRename();
      return;
    }
    const input = renameDraft.trim();
    const nextName = node.type === "file" ? `${input.replace(/\.[^.]+$/, "")}${renameExt}` : input;
    if (!nextName || nextName === node.name) {
      cancelRename();
      return;
    }
    const dir = dirOf(node.path);
    const to = dir ? `${dir}/${nextName}` : nextName;
    services.markModified(node.path);
    await api.rename(node.path, to);
    if (node.type === "file") {
      dispatch({ type: "renamePath", from: node.path, to, title: baseNoExt(nextName) });
    } else {
      setOpenDirs((prev) => {
        const next = new Set<string>();
        const prefix = `${node.path}/`;
        const nextPrefix = `${to}/`;
        for (const path of prev) {
          if (path === node.path) {
            next.add(to);
          } else if (path.startsWith(prefix)) {
            next.add(`${nextPrefix}${path.slice(prefix.length)}`);
          } else {
            next.add(path);
          }
        }
        return next;
      });
      dispatch({ type: "renamePrefix", from: node.path, to });
    }
    cancelRename();
    await refresh();
  };

  useEffect(() => {
    if (!renamePath) {
      return;
    }
    const node = findEntry(state.tree, renamePath);
    if (!node) {
      return;
    }
    setRenameDraft(node.name);
    openAncestors(node.path);
  }, [renamePath, state.tree]);

  useEffect(() => {
    if (!renameRequestPath) {
      return;
    }
    const node = findEntry(state.tree, renameRequestPath);
    if (!node) {
      return;
    }
    beginRename(node);
    onRenameRequestHandled();
  }, [renameRequestPath, state.tree, onRenameRequestHandled]);

  const rows = useMemo(() => {
    const out: FlatRow[] = [];
    flattenVisible(state.tree, 0, (path) => openDirs.has(path), out);
    return out;
  }, [state.tree, openDirs]);

  const virtual = useVirtual(rows.length, ROW_HEIGHT, scrollRef);

  useEffect(() => {
    if (!menu) {
      return;
    }
    if (menuRef.current) {
      const next = fitMenuToViewport(menu, menuRef.current);
      if (next.x !== menu.x || next.y !== menu.y) {
        setMenu((prev) => (prev ? { ...prev, ...next } : prev));
      }
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
    // Don't move a folder into itself or one of its descendants.
    if (toDir === fromPath || toDir.startsWith(`${fromPath}/`)) {
      return;
    }
    const isDir = findEntry(state.tree, fromPath)?.type === "directory";
    services.markModified(fromPath);
    await api.rename(fromPath, to);
    dispatch(
      isDir
        ? { type: "renamePrefix", from: fromPath, to }
        : { type: "renamePath", from: fromPath, to, title: baseNoExt(base) },
    );
    await refresh();
  };

  const newFolder = async (dir: string) => {
    const values = await openPrompt({
      title: "New folder",
      fields: [{ key: "name", label: "Folder name", required: true }],
      confirmLabel: "Create",
    });
    const input = values?.name.trim();
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
    onToggleDir: toggleDir,
    onContextMenu: (event, node) => openMenu(event, node),
    onMove: move,
    onBeginRename: beginRename,
    dragOverPath,
    setDragOverPath,
    typeOf: (path) => services.noteTypes[path],
    isOpen,
    renamePath,
    renameDraft,
    onRenameDraftChange: setRenameDraft,
    onRenameCommit: () => void commitRename(),
    onRenameCancel: cancelRename,
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
        { label: "New diagram", run: () => services.createMermaid(dir) },
        { label: "New calendar", run: () => services.createCalendar(dir) },
        { label: "New grid", run: () => services.createGrid(dir) },
        { label: "New folder…", run: () => void newFolder(dir) },
        ...(node
          ? [
              { label: "Rename…", run: () => beginRename(node) },
              { label: "Delete", run: () => void removeNode(node), danger: true },
            ]
          : []),
      ];
    }
    const electronApi = window.electronAPI;
    const revealInExplorer = electronApi
      ? [
          {
            label: "Show in file explorer",
            run: () => {
              void api
                .tome()
                .then(({ id }) => electronApi.revealPathInTome(id, node.path))
                .then((ok) => {
                  if (!ok) {
                    notify("Couldn't reveal the file in the system explorer", { kind: "error" });
                  }
                })
                .catch(() => notify("Couldn't reveal the file in the system explorer", { kind: "error" }));
            },
          },
        ]
      : [];
    return [
      { label: "Open", run: () => openNode(node) },
      ...revealInExplorer,
      { label: "Rename…", run: () => beginRename(node) },
      { label: "Delete", run: () => void removeNode(node), danger: true },
    ];
  };

  return (
    <div
      className="explorer"
      ref={scrollRef}
      onScroll={virtual.onScroll}
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
        <div className="tree-viewport" style={{ height: virtual.totalHeight }}>
          <div className="tree-window" style={{ transform: `translateY(${virtual.offsetY}px)` }}>
            {rows.slice(virtual.start, virtual.end).map((row) => (
              <TreeRow
                key={row.entry.path}
                entry={row.entry}
                depth={row.depth}
                handlers={handlers}
              />
            ))}
          </div>
        </div>
      )}

      {menu && (
        <div
          ref={menuRef}
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
      {promptDialog}
    </div>
  );
}
