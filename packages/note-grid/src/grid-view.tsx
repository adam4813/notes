import { useEffect, useRef, useState } from "react";
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

type Tool = "paint" | "erase" | "token";

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
  const [model, setModel] = useState<GridModel>(() => parseGrid(value));
  const [tool, setTool] = useState<Tool>("paint");
  const [color, setColor] = useState(PALETTE[3]);
  const [tokenLabel, setTokenLabel] = useState("●");
  const painting = useRef(false);
  const modelRef = useRef(model);
  modelRef.current = model;
  const lastSerialized = useRef(value);

  useEffect(() => {
    if (value !== lastSerialized.current) {
      const parsed = parseGrid(value);
      setModel(parsed);
      modelRef.current = parsed;
      lastSerialized.current = value;
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
    modelRef.current = next;
    const markdown = serializeGrid(next);
    lastSerialized.current = markdown;
    onChange(markdown);
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
    const existing = current.tokens.find((token) => token.x === x && token.y === y);
    const tokens = existing
      ? current.tokens.filter((token) => token !== existing)
      : [...current.tokens, { id: newId("tok"), x, y, label: tokenLabel || "●", color }];
    update({ ...current, tokens });
  };

  const onCellDown = (x: number, y: number) => {
    if (tool === "token") {
      toggleToken(x, y);
      return;
    }
    painting.current = true;
    paintCell(x, y);
  };

  const onCellEnter = (x: number, y: number) => {
    if (painting.current && tool !== "token") {
      paintCell(x, y);
    }
  };

  const setLayers = (layers: GridLayer[], activeLayer = model.activeLayer) =>
    update({ ...model, layers, activeLayer });

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

  const renameLayer = (id: string) => {
    const layer = model.layers.find((entry) => entry.id === id);
    const name = window.prompt("Layer name", layer?.name);
    if (!name) {
      return;
    }
    setLayers(model.layers.map((entry) => (entry.id === id ? { ...entry, name } : entry)));
  };

  const rows = Array.from({ length: model.height }, (_, y) => y);
  const cols = Array.from({ length: model.width }, (_, x) => x);

  return (
    <div className="grid-note">
      <div className="grid-toolbar">
        <div className="grid-tools" role="radiogroup" aria-label="Tool">
          {(["paint", "erase", "token"] as Tool[]).map((option) => (
            <button
              key={option}
              role="radio"
              aria-checked={tool === option}
              className={`mode-btn ${tool === option ? "mode-btn--active" : ""}`}
              onClick={() => setTool(option)}
            >
              {option === "paint" ? "Paint" : option === "erase" ? "Erase" : "Token"}
            </button>
          ))}
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
        {tool === "token" && (
          <input
            className="grid-token-label"
            aria-label="Token label"
            maxLength={2}
            value={tokenLabel}
            onChange={(event) => setTokenLabel(event.target.value)}
          />
        )}
      </div>

      <div className="grid-body">
        <div
          className="grid-canvas"
          data-testid="grid-canvas"
          style={{
            gridTemplateColumns: `repeat(${model.width}, ${model.cellSize}px)`,
          }}
          onMouseLeave={() => {
            painting.current = false;
          }}
        >
          {rows.map((y) =>
            cols.map((x) => {
              const fill = topColor(model, x, y);
              const token = model.tokens.find((entry) => entry.x === x && entry.y === y);
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
            }),
          )}
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
                  onDoubleClick={() => renameLayer(layer.id)}
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
  );
}
