import { useUndoStack } from "@notes/web/src/state/undo-context";
import { useEffect, useRef, useState } from "react";
import { NoteToolbar, usePromptDialog } from "@notes/editor";
import {
  cellKey,
  newId,
  parseGrid,
  serializeGrid,
  type GridLayer,
  type GridModel,
} from "./grid-format";

interface GridViewProps {
  value: string;
  onChange: (markdown: string) => void;
}

type Tool = "paint" | "erase" | "fill" | "token";

const PALETTE = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#111827", "#ffffff"];

function topColor(model: GridModel, x: number, y: number): string | undefined {
  let color: string | undefined;
  for (const layer of model.layers) {
    if (layer.visible) {
      const value = layer.cells[cellKey(x, y)];
      if (value) {
        color = value;
      }
    }
  }
  return color;
}

export function GridView({ value, onChange }: GridViewProps) {
  const { openPrompt, promptDialog } = usePromptDialog();
  const undoStack = useUndoStack();
  const [model, setModel] = useState<GridModel>(() => parseGrid(value));
  const [tool, setTool] = useState<Tool>("paint");
  const [color, setColor] = useState(PALETTE[3]);
  const [tokenLabel, setTokenLabel] = useState("●");
  const painting = useRef(false);
  const modelRef = useRef(model);
  const lastSerialized = useRef(value);
  const history = useRef<{ past: GridModel[]; future: GridModel[] }>({ past: [], future: [] });

  useEffect(() => {
    if (value !== lastSerialized.current) {
      const parsed = parseGrid(value);
      setModel(parsed);
      modelRef.current = parsed;
      lastSerialized.current = value;
      history.current = { past: [], future: [] };
    }
  }, [value]);

  useEffect(() => {
    const stop = () => {
      painting.current = false;
    };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  const update = (next: GridModel) => {
    setModel(next);
    const previous = modelRef.current;
    const previousMarkdown = serializeGrid(previous);
    modelRef.current = next;
    const markdown = serializeGrid(next);
    lastSerialized.current = markdown;

    undoStack.push({
      label: "Updated grid",
      undo: () => {
        setModel(previous);
        modelRef.current = previous;
        lastSerialized.current = previousMarkdown;
        onChange(previousMarkdown);
        return Promise.resolve();
      },
      redo: () => {
        setModel(next);
        modelRef.current = next;
        lastSerialized.current = markdown;
        onChange(markdown);
        return Promise.resolve();
      },
    });
    onChange(markdown);
  };

  /** Snapshots the current model so the next mutation can be undone. */
  const snapshot = () => {
    history.current.past.push(modelRef.current);
    if (history.current.past.length > 100) {
      history.current.past.shift();
    }
    history.current.future = [];
  };

  const floodFill = (x: number, y: number) => {
    const current = modelRef.current;
    const layer = current.layers.find((entry) => entry.id === current.activeLayer);
    if (!layer) {
      return;
    }
    const target = layer.cells[cellKey(x, y)] ?? "";
    if (target === color) {
      return;
    }
    const cells = { ...layer.cells };
    const stack: [number, number][] = [[x, y]];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const [cx, cy] = stack.pop() as [number, number];
      if (cx < 0 || cy < 0 || cx >= current.width || cy >= current.height) {
        continue;
      }
      const key = cellKey(cx, cy);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      if ((cells[key] ?? "") !== target) {
        continue;
      }
      cells[key] = color;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    update({
      ...current,
      layers: current.layers.map((entry) =>
        entry.id === current.activeLayer ? { ...entry, cells } : entry,
      ),
    });
  };

  const paintCell = (x: number, y: number) => {
    const current = modelRef.current;
    const layers = current.layers.map((layer) => {
      if (layer.id !== current.activeLayer) {
        return layer;
      }
      const cells = { ...layer.cells };
      if (tool === "erase") {
        delete cells[cellKey(x, y)];
      } else {
        cells[cellKey(x, y)] = color;
      }
      return { ...layer, cells };
    });
    update({ ...current, layers });
  };

  const toggleToken = (x: number, y: number) => {
    const current = modelRef.current;
    const existing = current.tokens.find(
      (token) => token.x === x && token.y === y && token.layer === current.activeLayer,
    );
    const tokens = existing
      ? current.tokens.filter((token) => token !== existing)
      : [
          ...current.tokens,
          { id: newId("tok"), x, y, label: tokenLabel || "●", color, layer: current.activeLayer },
        ];
    update({ ...current, tokens });
  };

  const onCellDown = (x: number, y: number) => {
    snapshot();
    if (tool === "token") {
      toggleToken(x, y);
      return;
    }
    if (tool === "fill") {
      floodFill(x, y);
      return;
    }
    painting.current = true;
    paintCell(x, y);
  };

  const onCellEnter = (x: number, y: number) => {
    if (painting.current && (tool === "paint" || tool === "erase")) {
      paintCell(x, y);
    }
  };

  const setLayers = (layers: GridLayer[], activeLayer = model.activeLayer) => {
    snapshot();
    update({ ...model, layers, activeLayer });
  };

  const addLayer = () => {
    const layer: GridLayer = {
      id: newId("layer"),
      name: `Layer ${model.layers.length + 1}`,
      visible: true,
      cells: {},
    };
    setLayers([...model.layers, layer], layer.id);
  };

  const removeLayer = (id: string) => {
    if (model.layers.length <= 1) {
      return;
    }
    const layers = model.layers.filter((layer) => layer.id !== id);
    setLayers(layers, layers[0].id);
  };

  const toggleVisible = (id: string) =>
    setLayers(
      model.layers.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer,
      ),
    );

  const renameLayer = async (id: string) => {
    const layer = model.layers.find((entry) => entry.id === id);
    const values = await openPrompt({
      title: "Rename layer",
      fields: [
        { key: "name", label: "Layer name", defaultValue: layer?.name ?? "", required: true },
      ],
      confirmLabel: "Rename",
    });
    if (!values) {
      return;
    }
    const name = values.name;
    setLayers(model.layers.map((entry) => (entry.id === id ? { ...entry, name } : entry)));
  };

  const rows = Array.from({ length: model.height }, (_, y) => y);
  const cols = Array.from({ length: model.width }, (_, x) => x);

  const resize = (patch: { width?: number; height?: number }) => {
    const width = Math.min(64, Math.max(1, patch.width ?? model.width));
    const height = Math.min(64, Math.max(1, patch.height ?? model.height));
    snapshot();
    update({ ...model, width, height });
  };

  return (
    <>
      <div className="grid-note" tabIndex={0}>
        <NoteToolbar label="Grid tools" className="grid-toolbar">
          <div className="grid-tools" role="radiogroup" aria-label="Tool">
            {(["paint", "erase", "fill", "token"] as Tool[]).map((option) => (
              <button
                key={option}
                role="radio"
                aria-checked={tool === option}
                className={`tb-btn ${tool === option ? "tb-btn--active" : ""}`}
                onClick={() => setTool(option)}
              >
                {option === "paint"
                  ? "Paint"
                  : option === "erase"
                    ? "Erase"
                    : option === "fill"
                      ? "Fill"
                      : "Token"}
              </button>
            ))}
          </div>
          <div className="grid-history">
            <button
              className="tb-btn"
              aria-label="Undo"
              disabled={!undoStack.canUndo}
              onClick={undoStack.undo}
            >
              ↶
            </button>
            <button
              className="tb-btn"
              aria-label="Redo"
              disabled={!undoStack.canRedo}
              onClick={undoStack.redo}
            >
              ↷
            </button>
          </div>
          <div className="grid-palette">
            {PALETTE.map((swatch) => (
              <button
                key={swatch}
                aria-label={`Color ${swatch}`}
                className={`grid-swatch ${color === swatch ? "grid-swatch--active" : ""}`}
                style={{ background: swatch }}
                onClick={() => setColor(swatch)}
              />
            ))}
            <input
              type="color"
              aria-label="Custom color"
              className="accent-custom"
              value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#3b82f6"}
              onChange={(event) => setColor(event.target.value)}
            />
          </div>
          {tool === "token" ? (
            <label className="grid-size-field">
              Token
              <input
                className="grid-token-label"
                aria-label="Token label"
                maxLength={2}
                value={tokenLabel}
                onChange={(event) => setTokenLabel(event.target.value)}
              />
            </label>
          ) : (
            <div className="grid-size">
              <label className="grid-size-field">
                W
                <input
                  type="number"
                  min={1}
                  max={64}
                  aria-label="Grid width"
                  value={model.width}
                  onChange={(event) => resize({ width: Number(event.target.value) })}
                />
              </label>
              <label className="grid-size-field">
                H
                <input
                  type="number"
                  min={1}
                  max={64}
                  aria-label="Grid height"
                  value={model.height}
                  onChange={(event) => resize({ height: Number(event.target.value) })}
                />
              </label>
            </div>
          )}
        </NoteToolbar>

        {tool === "token" && (
          <div className="grid-hint">
            Click a cell to place or remove a token on the active layer.
          </div>
        )}

        <div className="grid-body">
          <div
            className="grid-canvas"
            data-testid="grid-canvas"
            onMouseLeave={() => {
              painting.current = false;
            }}
          >
            {rows.map((y) => (
              <div key={y} className="grid-row">
                {cols.map((x) => {
                  const fill = topColor(model, x, y);
                  const visibleLayers = new Set(
                    model.layers.filter((layer) => layer.visible).map((layer) => layer.id),
                  );
                  const token = model.tokens.find(
                    (entry) => entry.x === x && entry.y === y && visibleLayers.has(entry.layer),
                  );
                  return (
                    <div
                      key={cellKey(x, y)}
                      className="grid-cell"
                      data-cell={cellKey(x, y)}
                      style={{ width: model.cellSize, height: model.cellSize, background: fill }}
                      onMouseDown={() => onCellDown(x, y)}
                      onMouseEnter={() => onCellEnter(x, y)}
                    >
                      {token && (
                        <span className="grid-token" style={{ color: token.color }}>
                          {token.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <aside className="grid-layers">
            <div className="grid-layers-head">
              <span>Layers</span>
              <button className="btn-ghost" aria-label="Add layer" onClick={addLayer}>
                ＋
              </button>
            </div>
            <ul className="grid-layer-list">
              {[...model.layers].reverse().map((layer) => (
                <li
                  key={layer.id}
                  className={`grid-layer ${layer.id === model.activeLayer ? "grid-layer--active" : ""}`}
                >
                  <button
                    className="grid-layer-vis"
                    aria-label={layer.visible ? "Hide layer" : "Show layer"}
                    onClick={() => toggleVisible(layer.id)}
                  >
                    {layer.visible ? "👁" : "🚫"}
                  </button>
                  <button
                    className="grid-layer-name"
                    onClick={() => setLayers(model.layers, layer.id)}
                    onDoubleClick={() => void renameLayer(layer.id)}
                    title="Click to select, double-click to rename"
                  >
                    {layer.name}
                  </button>
                  <button
                    className="grid-layer-remove"
                    aria-label={`Remove ${layer.name}`}
                    onClick={() => removeLayer(layer.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
      {promptDialog}
    </>
  );
}
