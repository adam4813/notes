import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
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
  /** Subscribe to a specific file path's changes; returns a disposer. */
  subscribeToFileChange?: (filePath: string, cb: () => void) => () => void;
}

/** Note MIME type set by the explorer on drag. */
const NOTES_DRAG_MIME = "application/x-notes-path";

function fileBasename(p: string): string {
  return (p.split("/").pop() ?? p).replace(/\.[^.]+$/, "");
}

function extractPreview(
  content: string,
  filePath: string,
): { title: string; body: string; type: string } {
  const fmMatch = /^---\n([\s\S]*?)\n---\n?/.exec(content);
  const yaml = fmMatch ? fmMatch[1] : "";
  const bodyText = fmMatch ? content.slice(fmMatch[0].length).trim() : content.trim();
  const titleMatch = /^title:\s*["']?(.+?)["']?\s*$/m.exec(yaml);
  const typeMatch = /^type:\s*(.+)$/m.exec(yaml);
  const h1Match = /^#\s+(.+)$/m.exec(bodyText);
  const title = (titleMatch?.[1] || h1Match?.[1] || fileBasename(filePath)).trim();
  const type =
    typeMatch?.[1].trim() ??
    (filePath.toLowerCase().endsWith(".canvas") ? "canvas" : "markdown");
  const preview = bodyText.length > 500 ? `${bodyText.slice(0, 500)}…` : bodyText;
  return { title, body: preview, type };
}

function FileNodeCard({
  file,
  onOpen,
  subscribeToFileChange,
}: {
  file: string;
  onOpen?: () => void;
  subscribeToFileChange?: (filePath: string, cb: () => void) => () => void;
}) {
  const [title, setTitle] = useState(() => fileBasename(file));
  const [body, setBody] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(file)}`);
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = (await res.json()) as { content: string };
      const { title: t, body: b, type } = extractPreview(data.content, file);
      setTitle(t);
      setBody(b);
      setBlocked(["canvas", "board", "calendar"].includes(type));
      setError(false);
    } catch {
      setError(true);
    }
  }, [file]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!subscribeToFileChange) return;
    return subscribeToFileChange(file, () => void load());
  }, [file, load, subscribeToFileChange]);

  if (blocked) {
    return (
      <div className="canvas-file-card canvas-file-card--blocked">
        <div className="canvas-file-header">
          <span className="canvas-file-title">🚫 {fileBasename(file)}</span>
        </div>
        <div className="canvas-file-hint">This note type cannot be previewed here.</div>
        <button
          className="canvas-file-open-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onOpen}
        >
          Open ↗
        </button>
      </div>
    );
  }

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

  if (body === null) {
    return <div className="canvas-file-loading">Loading…</div>;
  }

  return (
    <div className="canvas-file-card">
      <div className="canvas-file-header" onPointerDown={(e) => e.stopPropagation()}>
        <span className="canvas-file-icon">📄</span>
        <span className="canvas-file-title">{title}</span>
        <button
          className="canvas-file-open-btn"
          aria-label={`Open ${title}`}
          onClick={onOpen}
        >
          ⤢
        </button>
      </div>
      <div className="canvas-file-body">{body || "(empty note)"}</div>
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

export function CanvasView({ value, onChange, onOpenFile, path, subscribeToFileChange }: CanvasViewProps) {
  const [data, setData] = useState<CanvasData>(() => parseCanvas(value));
  const [viewport, setViewport] = useState<Viewport>({ x: 40, y: 40, scale: 1 });
  const [selection, setSelection] = useState<Selection>(null);
  const [editing, setEditing] = useState<string | null>(null);
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

  const pushChange = (next: CanvasData) => {
    lastSerialized.current = serializeCanvas(next);
    onChange(lastSerialized.current);
  };

  const commit = (next: CanvasData) => {
    setData(next);
    pushChange(next);
  };

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
              ? { ...n, width: Math.max(80, drag.origW + dw), height: Math.max(40, drag.origH + dh) }
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

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = event.clientX - (rect?.left ?? 0);
    const cy = event.clientY - (rect?.top ?? 0);
    setViewport((vp) => {
      const worldX = (cx - vp.x) / vp.scale;
      const worldY = (cy - vp.y) / vp.scale;
      const scale = Math.min(3, Math.max(0.2, vp.scale * (event.deltaY < 0 ? 1.1 : 0.9)));
      return { x: cx - worldX * scale, y: cy - worldY * scale, scale };
    });
  };

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
    addNode({ id: newId("node"), type: "text", x: 0, y: 0, width: 220, height: 100, text: "New note" });

  const addFile = () => {
    const file = window.prompt("Note path to embed (e.g. notes/ideas.md)");
    if (!file) {
      return;
    }
    addNode({ id: newId("node"), type: "file", x: 0, y: 0, width: 240, height: 120, file });
  };

  const addLink = () => {
    const url = window.prompt("Link URL", "https://");
    if (!url) {
      return;
    }
    addNode({ id: newId("node"), type: "link", x: 0, y: 0, width: 240, height: 80, url });
  };

  /** Handles drops of note files from the explorer onto the canvas. */
  const onViewportDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    const notePath = event.dataTransfer.getData(NOTES_DRAG_MIME);
    if (!notePath) return;
    event.preventDefault();
    event.stopPropagation();
    const world = screenToWorld(event.clientX, event.clientY);
    const node: FileNode = {
      id: newId("file"),
      type: "file",
      file: notePath,
      x: world.x - 160,
      y: world.y - 120,
      width: 320,
      height: 240,
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

  const deleteSelection = () => {
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
  };

  const setEdgeLabel = (edgeId: string, label: string) =>
    commit({
      ...data,
      edges: data.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, ...(label ? { label } : { label: undefined }) } : edge,
      ),
    });

  const editEdgeLabel = (edgeId: string) => {
    const edge = data.edges.find((e) => e.id === edgeId);
    const label = window.prompt("Edge label", edge?.label ?? "");
    if (label !== null) {
      setEdgeLabel(edgeId, label.trim());
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
      <div className="canvas-toolbar">
        <button className="btn-ghost" onClick={addText}>
          ＋ Text
        </button>
        <button className="btn-ghost" onClick={addFile}>
          ＋ Note
        </button>
        <button className="btn-ghost" onClick={addLink}>
          ＋ Link
        </button>
        <button className="btn-ghost" disabled={!selection} onClick={deleteSelection}>
          Delete
        </button>
        <span className="canvas-meta">{Math.round(viewport.scale * 100)}%</span>
        <button className="btn-ghost" onClick={resetView}>
          Fit view
        </button>
      </div>
      <div
        className="canvas-viewport"
        ref={containerRef}
        onPointerDown={onBackgroundPointerDown}
        onWheel={onWheel}
        onDrop={onViewportDrop}
        onDragOver={onViewportDragOver}
        data-testid="canvas-viewport"
      >
        <div
          className="canvas-world"
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
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
                      editEdgeLabel(edge.id);
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
                        editEdgeLabel(edge.id);
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
                          editEdgeLabel(edge.id);
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
            return (
              <div
                key={node.id}
                className={`canvas-node canvas-node--${node.type} ${isSelected ? "canvas-node--selected" : ""}`}
                style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                onPointerDown={(event) => startMove(event, node)}
                onDoubleClick={() => node.type === "text" && setEditing(node.id)}
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
                    onOpen={() => onOpenFile?.(node.file)}
                    subscribeToFileChange={subscribeToFileChange}
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
    </div>
  );
}
