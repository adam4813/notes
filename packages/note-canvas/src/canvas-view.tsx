import { connectTomeChanges } from "@notes/web/src/api/ws";
import { getFrontmatterField, parseFrontmatter } from "@notes/web/src/lib/frontmatter";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { NoteEditor } from "@notes/web/src/components/note-editor";
import { NoteToolbar, usePromptDialog } from "@notes/editor";
import {
  parseCanvas,
  serializeCanvas,
  type CanvasData,
  type CanvasNode,
  type FileNode,
} from "./canvas-format";

interface CanvasViewProps {
  value: string;
  onChange: (text: string) => void;
  onOpenFile?: (path: string) => void;
  path: string;
}

/** Note MIME type set by the explorer on drag. */
const NOTES_DRAG_MIME = "application/x-notes-path";

function fileBasename(p: string): string {
  return (p.split("/").pop() ?? p).replace(/\.[^.]+$/, "");
}

function detectNoteInfo(content: string, filePath: string): { title: string; type: string } {
  const parsed = parseFrontmatter(content);
  const titleMatch = getFrontmatterField(parsed.props, "title") ?? "";
  const typeMatch = getFrontmatterField(parsed.props, "type") ?? "";
  const h1Match = /^#\s+(.+)$/m.exec(parsed.body ?? content);
  const title = (titleMatch || h1Match?.[1] || fileBasename(filePath)).trim();
  const type =
    typeMatch.trim() ?? (filePath.toLowerCase().endsWith(".canvas") ? "canvas" : "markdown");
  return { title, type };
}

function estimateFileNodeSize(
  content: string,
  filePath: string,
): { width: number; height: number } {
  const fmMatch = /^---\n([\s\S]*?)\n---\n?/.exec(content);
  const body = fmMatch ? content.slice(fmMatch[0].length) : content;
  const { title } = detectNoteInfo(content, filePath);
  const lines = body.split(/\r?\n/);
  const longestLine = Math.max(title.length, ...lines.map((line) => line.length), 0);
  return {
    width: Math.min(600, Math.max(240, Math.round(longestLine * 7.5 + 72))),
    height: Math.min(400, Math.max(120, Math.round(lines.length * 18 + 56))),
  };
}

const BLOCKED_TYPES = new Set(["canvas"]);

function FileNodeCard({
  file,
  isVisible,
  onOpen,
}: {
  file: string;
  isVisible: boolean;
  onOpen?: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [title, setTitle] = useState(() => fileBasename(file));
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const contentRef = useRef("");

  const subscribeToFileChange = useCallback(
    (filePath: string, cb: () => void) =>
      connectTomeChanges((change) => {
        if (change.path === filePath) cb();
      }),
    [],
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(file)}`);
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = (await res.json()) as { content: string; type: string };
      const { title: t, type } = detectNoteInfo(data.content, file);
      setTitle(t);
      setType(type === "markdown" && file.endsWith(".md") ? "markdown" : data.type.split("/")[0]);
      setBlocked(BLOCKED_TYPES.has(type));
      contentRef.current = data.content;
      setContent(data.content);
      setError(false);
    } catch {
      setError(true);
    }
  }, [file]);

  // Only fetch when the node is visible (or editing).
  useEffect(() => {
    if (isVisible) {
      void load();
    }
  }, [load, isVisible]);

  useEffect(() => {
    if (!subscribeToFileChange) return;
    return subscribeToFileChange(file, () => {
      if (isVisible) void load();
    });
  }, [file, load, subscribeToFileChange, isVisible]);

  // Ctrl+S forces immediate save while editing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        clearTimeout(saveTimer.current);
        void fetch("/api/file", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: file, content: contentRef.current }),
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file]);

  // ---- Blocked card ----
  if (blocked) {
    return (
      <div className="canvas-file-card canvas-file-card--blocked">
        <div className="canvas-file-header">
          <span className="canvas-file-icon">📄</span>
          <span className="canvas-file-title">{fileBasename(file)}</span>
          <button
            className="canvas-file-open-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onOpen}
            aria-label="Open"
          >
            ⤢
          </button>
        </div>
        <div className="canvas-file-hint">Open to view or edit this note type.</div>
      </div>
    );
  }

  // ---- Error card ----
  if (error) {
    return (
      <div className="canvas-file-card canvas-file-card--error">
        <div className="canvas-file-header">
          <span className="canvas-file-title">Note not found</span>
        </div>
        <div className="canvas-file-hint">{file}</div>
      </div>
    );
  }

  // ---- Loading ----
  if (!isVisible && content === null) {
    return <div className="canvas-file-card canvas-file-card--offscreen" />;
  }
  if (content === null) {
    return <div className="canvas-file-loading">Loading…</div>;
  }

  // ---- Active editor ----
  return (
    <div className="canvas-file-card canvas-file-card--editing">
      <div className="canvas-file-header">
        <span className="canvas-file-icon">📄</span>
        <span className="canvas-file-title">{title}</span>
        <button
          className="canvas-file-open-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onOpen}
          aria-label="Open in tab"
        >
          ⤢
        </button>
      </div>

      {type === "image" ? (
        <div className="canvas-file-preview">
          <img src={`/api/file/raw?path=${encodeURIComponent(file)}`} alt={title} />
        </div>
      ) : (
        <div className="canvas-file-editor" onPointerDown={(e) => e.stopPropagation()}>
          <NoteEditor path={file} defaultMode="rendered" disableModeToggle />
        </div>
      )}
    </div>
  );
}

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

const MAX_FIT_ZOOM = 1;

function viewportStorageKey(path: string): string {
  return `notes.canvas.viewport:${path}`;
}

/** Centers all nodes within the container, capped at MAX_FIT_ZOOM. */
function computeFit(nodes: CanvasNode[], width: number, height: number): Viewport {
  if (nodes.length === 0) {
    return { x: width / 2, y: height / 2, scale: 1 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }
  const pad = 48;
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const scale = Math.min(
    MAX_FIT_ZOOM,
    Math.max(0.2, Math.min((width - pad * 2) / contentWidth, (height - pad * 2) / contentHeight)),
  );
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return { x: width / 2 - centerX * scale, y: height / 2 - centerY * scale, scale };
}

type Selection = { kind: "node" | "edge"; id: string } | null;

type DragState =
  | { type: "pan"; startX: number; startY: number; origX: number; origY: number }
  | { type: "move"; id: string; startX: number; startY: number; origX: number; origY: number }
  | { type: "resize"; id: string; startX: number; startY: number; origW: number; origH: number }
  | { type: "connect"; from: string }
  | null;

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function center(node: CanvasNode): { x: number; y: number } {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

export function CanvasView({ value, onChange, onOpenFile, path }: CanvasViewProps) {
  const { openPrompt, promptDialog } = usePromptDialog();
  const [data, setData] = useState<CanvasData>(() => parseCanvas(value));
  const [viewport, setViewport] = useState<Viewport>({ x: 40, y: 40, scale: 1 });
  const [selection, setSelection] = useState<Selection>(null);
  const [editing, setEditing] = useState<string | null>(null); // text node inline editing
  const [connectPos, setConnectPos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const lastSerialized = useRef(value);
  const dragRef = useRef<DragState>(null);
  const didInit = useRef(false);

  useEffect(() => {
    if (value !== lastSerialized.current) {
      setData(parseCanvas(value));
      lastSerialized.current = value;
    }
  }, [value]);

  // Initial viewport: restore the last position, else fit all nodes (max zoom 1).
  useEffect(() => {
    if (didInit.current) {
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 800;
    const height = rect?.height ?? 600;
    let next: Viewport | null = null;
    try {
      const saved = window.localStorage.getItem(viewportStorageKey(path));
      if (saved) {
        const parsed = JSON.parse(saved) as Viewport;
        if (typeof parsed.x === "number" && typeof parsed.y === "number" && parsed.scale > 0) {
          next = parsed;
        }
      }
    } catch {
      next = null;
    }
    setViewport(next ?? computeFit(dataRef.current.nodes, width, height));
    didInit.current = true;
  }, [path]);

  // Persist the viewport per note.
  useEffect(() => {
    if (!didInit.current) {
      return;
    }
    try {
      window.localStorage.setItem(viewportStorageKey(path), JSON.stringify(viewport));
    } catch {
      // ignore storage errors
    }
  }, [viewport, path]);

  const resetView = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    setViewport(computeFit(dataRef.current.nodes, rect?.width ?? 800, rect?.height ?? 600));
  };

  const pushChange = useCallback(
    (next: CanvasData) => {
      lastSerialized.current = serializeCanvas(next);
      onChange(lastSerialized.current);
    },
    [onChange],
  );

  const commit = useCallback(
    (next: CanvasData) => {
      setData(next);
      pushChange(next);
    },
    [pushChange],
  );

  const screenToWorld = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const vp = viewportRef.current;
    const sx = clientX - (rect?.left ?? 0);
    const sy = clientY - (rect?.top ?? 0);
    return { x: (sx - vp.x) / vp.scale, y: (sy - vp.y) / vp.scale };
  };

  const hitNode = (wx: number, wy: number): CanvasNode | undefined => {
    const nodes = dataRef.current.nodes;
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const node = nodes[i];
      if (wx >= node.x && wx <= node.x + node.width && wy >= node.y && wy <= node.y + node.height) {
        return node;
      }
    }
    return undefined;
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      const scale = viewportRef.current.scale;
      if (drag.type === "pan") {
        setViewport((vp) => ({
          ...vp,
          x: drag.origX + (event.clientX - drag.startX),
          y: drag.origY + (event.clientY - drag.startY),
        }));
      } else if (drag.type === "move") {
        const dx = (event.clientX - drag.startX) / scale;
        const dy = (event.clientY - drag.startY) / scale;
        setData((d) => ({
          ...d,
          nodes: d.nodes.map((n) =>
            n.id === drag.id ? { ...n, x: drag.origX + dx, y: drag.origY + dy } : n,
          ),
        }));
      } else if (drag.type === "resize") {
        const dw = (event.clientX - drag.startX) / scale;
        const dh = (event.clientY - drag.startY) / scale;
        setData((d) => ({
          ...d,
          nodes: d.nodes.map((n) =>
            n.id === drag.id
              ? {
                  ...n,
                  width: Math.max(80, drag.origW + dw),
                  height: Math.max(40, drag.origH + dh),
                }
              : n,
          ),
        }));
      } else if (drag.type === "connect") {
        setConnectPos(screenToWorld(event.clientX, event.clientY));
      }
    };

    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) {
        return;
      }
      if (drag.type === "connect") {
        const world = screenToWorld(event.clientX, event.clientY);
        const target = hitNode(world.x, world.y);
        if (target && target.id !== drag.from) {
          commit({
            ...dataRef.current,
            edges: [
              ...dataRef.current.edges,
              { id: newId("edge"), fromNode: drag.from, toNode: target.id },
            ],
          });
        }
        setConnectPos(null);
      } else if (drag.type === "move" || drag.type === "resize") {
        pushChange(dataRef.current);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".canvas-file-card")) {
        return;
      }
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
      setViewport((vp) => {
        const worldX = (cx - vp.x) / vp.scale;
        const worldY = (cy - vp.y) / vp.scale;
        const scale = Math.min(3, Math.max(0.2, vp.scale * (event.deltaY < 0 ? 1.1 : 0.9)));
        return { x: cx - worldX * scale, y: cy - worldY * scale, scale };
      });
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  const onBackgroundPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Nodes, handles, and edge hit-lines stopPropagation, so any event that
    // reaches here is on empty canvas → start a pan and clear selection.
    setSelection(null);
    setEditing(null);
    dragRef.current = {
      type: "pan",
      startX: event.clientX,
      startY: event.clientY,
      origX: viewport.x,
      origY: viewport.y,
    };
  };

  const startMove = (event: ReactPointerEvent, node: CanvasNode) => {
    event.stopPropagation();
    // If THIS FileNode is being edited, don't start a move from its node div
    // (the title bar doesn't stopPropagation here so it CAN start a move via this handler).
    setSelection({ kind: "node", id: node.id });
    dragRef.current = {
      type: "move",
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      origX: node.x,
      origY: node.y,
    };
  };

  const startResize = (event: ReactPointerEvent, node: CanvasNode) => {
    event.stopPropagation();
    dragRef.current = {
      type: "resize",
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      origW: node.width,
      origH: node.height,
    };
  };

  const startConnect = (event: ReactPointerEvent, node: CanvasNode) => {
    event.stopPropagation();
    dragRef.current = { type: "connect", from: node.id };
    setConnectPos(screenToWorld(event.clientX, event.clientY));
  };

  const addNode = (node: CanvasNode) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const world = screenToWorld(
      (rect?.left ?? 0) + (rect?.width ?? 400) / 2,
      (rect?.top ?? 0) + (rect?.height ?? 300) / 2,
    );
    const placed = { ...node, x: world.x - node.width / 2, y: world.y - node.height / 2 };
    commit({ ...data, nodes: [...data.nodes, placed] });
    setSelection({ kind: "node", id: placed.id });
  };

  const addText = () =>
    addNode({
      id: newId("node"),
      type: "text",
      x: 0,
      y: 0,
      width: 220,
      height: 100,
      text: "New note",
    });

  const addFile = async () => {
    const values = await openPrompt({
      title: "Embed note",
      fields: [
        {
          key: "file",
          label: "Note path",
          placeholder: "notes/ideas.md",
          required: true,
        },
      ],
      confirmLabel: "Embed",
    });
    if (!values) {
      return;
    }
    const file = values.file.trim();
    if (!file) {
      return;
    }
    addNode({ id: newId("node"), type: "file", x: 0, y: 0, width: 240, height: 120, file });
  };

  const addLink = async () => {
    const values = await openPrompt({
      title: "Add link",
      fields: [
        { key: "url", label: "Link URL", type: "url", defaultValue: "https://", required: true },
      ],
      confirmLabel: "Add",
    });
    if (!values) {
      return;
    }
    const url = values.url.trim();
    if (!url) {
      return;
    }
    addNode({ id: newId("node"), type: "link", x: 0, y: 0, width: 240, height: 80, url });
  };

  /** Handles drops of note files from the explorer onto the canvas. */
  const onViewportDrop = async (event: ReactDragEvent<HTMLDivElement>) => {
    const notePath = event.dataTransfer.getData(NOTES_DRAG_MIME);
    if (!notePath) return;
    const { clientX, clientY } = event;
    event.preventDefault();
    event.stopPropagation();
    const world = screenToWorld(clientX, clientY);
    let width = 320;
    let height = 240;
    const res = await fetch(`/api/file?path=${encodeURIComponent(notePath)}`);
    if (res.ok) {
      const data = (await res.json()) as { content?: string };
      if (typeof data.content === "string") {
        const size = estimateFileNodeSize(data.content, notePath);
        width = size.width;
        height = size.height;
      }
    }
    const node: FileNode = {
      id: newId("file"),
      type: "file",
      file: notePath,
      x: world.x - width / 2,
      y: world.y - height / 2,
      width,
      height,
    };
    commit({ ...data, nodes: [...data.nodes, node] });
    setSelection({ kind: "node", id: node.id });
  };

  const onViewportDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes(NOTES_DRAG_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const deleteSelection = useCallback(() => {
    if (!selection) {
      return;
    }
    if (selection.kind === "node") {
      commit({
        nodes: data.nodes.filter((n) => n.id !== selection.id),
        edges: data.edges.filter((e) => e.fromNode !== selection.id && e.toNode !== selection.id),
      });
    } else {
      commit({ ...data, edges: data.edges.filter((e) => e.id !== selection.id) });
    }
    setSelection(null);
  }, [data, selection]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Delete") {
        deleteSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [deleteSelection]);

  const setEdgeLabel = (edgeId: string, label: string) =>
    commit({
      ...data,
      edges: data.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, ...(label ? { label } : { label: undefined }) } : edge,
      ),
    });

  const editEdgeLabel = async (edgeId: string) => {
    const edge = data.edges.find((e) => e.id === edgeId);
    const values = await openPrompt({
      title: "Edit edge label",
      fields: [{ key: "label", label: "Label", defaultValue: edge?.label ?? "" }],
      confirmLabel: "Save",
    });
    if (values) {
      setEdgeLabel(edgeId, values.label.trim());
    }
  };

  const setNodeText = (id: string, text: string) => {
    setData((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === id && n.type === "text" ? { ...n, text } : n)),
    }));
  };

  const nodeById = (id: string) => data.nodes.find((n) => n.id === id);

  return (
    <div className="canvas-note">
      <NoteToolbar
        label="Canvas tools"
        className="canvas-toolbar"
        trailing={
          <>
            <span className="canvas-meta">{Math.round(viewport.scale * 100)}%</span>
            <button className="tb-btn" onClick={resetView}>
              Fit view
            </button>
          </>
        }
      >
        <button className="tb-btn" onClick={addText}>
          ＋ Text
        </button>
        <button className="tb-btn" onClick={() => void addFile()}>
          ＋ Note
        </button>
        <button className="tb-btn" onClick={() => void addLink()}>
          ＋ Link
        </button>
        <button className="tb-btn" disabled={!selection} onClick={deleteSelection}>
          Delete
        </button>
      </NoteToolbar>
      <div
        className="canvas-viewport"
        ref={containerRef}
        onPointerDown={onBackgroundPointerDown}
        onDrop={onViewportDrop}
        onDragOver={onViewportDragOver}
        data-testid="canvas-viewport"
      >
        <div
          className="canvas-world"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          }}
        >
          <svg className="canvas-edges" aria-hidden>
            <defs>
              <marker
                id="canvas-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--fg-muted)" />
              </marker>
            </defs>
            {data.edges.map((edge) => {
              const from = nodeById(edge.fromNode);
              const to = nodeById(edge.toNode);
              if (!from || !to) {
                return null;
              }
              const a = center(from);
              const b = center(to);
              const isSelected = selection?.kind === "edge" && selection.id === edge.id;
              const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
              return (
                <g key={edge.id}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={`canvas-edge ${isSelected ? "canvas-edge--selected" : ""}`}
                    markerEnd="url(#canvas-arrow)"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className="canvas-edge-hit"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setSelection({ kind: "edge", id: edge.id });
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      void editEdgeLabel(edge.id);
                    }}
                  />
                  {edge.label ? (
                    <text
                      x={mid.x}
                      y={mid.y}
                      className="canvas-edge-label"
                      textAnchor="middle"
                      dominantBaseline="central"
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        void editEdgeLabel(edge.id);
                      }}
                    >
                      {edge.label}
                    </text>
                  ) : (
                    isSelected && (
                      <text
                        x={mid.x}
                        y={mid.y}
                        className="canvas-edge-label canvas-edge-label--add"
                        textAnchor="middle"
                        dominantBaseline="central"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          void editEdgeLabel(edge.id);
                        }}
                      >
                        ＋ label
                      </text>
                    )
                  )}
                </g>
              );
            })}
            {connectPos &&
              dragRef.current?.type === "connect" &&
              (() => {
                const from = nodeById(dragRef.current.from);
                if (!from) {
                  return null;
                }
                const a = center(from);
                return (
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={connectPos.x}
                    y2={connectPos.y}
                    className="canvas-edge canvas-edge--preview"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })()}
          </svg>

          {data.nodes.map((node) => {
            const isSelected = selection?.kind === "node" && selection.id === node.id;
            // Viewport culling: skip expensive render when node is off-screen.
            const rect = containerRef.current?.getBoundingClientRect();
            const cw = rect?.width ?? 800;
            const ch = rect?.height ?? 600;
            const nodeScreenLeft = node.x * viewport.scale + viewport.x;
            const nodeScreenTop = node.y * viewport.scale + viewport.y;
            const isVisible =
              nodeScreenLeft + node.width * viewport.scale > -200 &&
              nodeScreenTop + node.height * viewport.scale > -200 &&
              nodeScreenLeft < cw + 200 &&
              nodeScreenTop < ch + 200;

            return (
              <div
                key={node.id}
                className={`canvas-node canvas-node--${node.type} ${isSelected ? "canvas-node--selected" : ""}`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                }}
                onPointerDown={(event) => startMove(event, node)}
                onDoubleClick={() => {
                  if (node.type === "text") setEditing(node.id);
                }}
              >
                {node.type === "text" &&
                  (editing === node.id ? (
                    <textarea
                      autoFocus
                      className="canvas-text-input"
                      value={node.text}
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(event) => setNodeText(node.id, event.target.value)}
                      onBlur={() => {
                        setEditing(null);
                        pushChange(dataRef.current);
                      }}
                    />
                  ) : (
                    <div className="canvas-text">{node.text}</div>
                  ))}

                {node.type === "file" && (
                  <FileNodeCard
                    file={node.file}
                    isVisible={isVisible}
                    onOpen={() => onOpenFile?.(node.file)}
                  />
                )}

                {node.type === "link" && (
                  <div className="canvas-link">
                    <span className="canvas-file-icon">🔗</span>
                    <a
                      href={node.url}
                      target="_blank"
                      rel="noreferrer"
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      {node.url}
                    </a>
                  </div>
                )}

                <span
                  className="canvas-connect"
                  title="Drag to connect"
                  onPointerDown={(event) => startConnect(event, node)}
                />
                <span
                  className="canvas-resize"
                  onPointerDown={(event) => startResize(event, node)}
                />
              </div>
            );
          })}
        </div>
        {data.nodes.length === 0 && (
          <div className="canvas-empty">Add a Text, Note, or Link node to start.</div>
        )}
      </div>
      {promptDialog}
    </div>
  );
}
