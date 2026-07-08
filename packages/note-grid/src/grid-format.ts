const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

export interface GridToken {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
  /** Id of the layer this token belongs to (hidden when the layer is hidden). */
  layer: string;
}

export interface GridLayer {
  id: string;
  name: string;
  visible: boolean;
  /** Painted cells keyed by "x,y" → CSS color. */
  cells: Record<string, string>;
}

export interface GridModel {
  frontmatter: string;
  width: number;
  height: number;
  cellSize: number;
  layers: GridLayer[];
  activeLayer: string;
  tokens: GridToken[];
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

interface GridData {
  width?: number;
  height?: number;
  cellSize?: number;
  layers?: GridLayer[];
  activeLayer?: string;
  tokens?: GridToken[];
}

function defaultLayer(): GridLayer {
  return { id: "layer-1", name: "Layer 1", visible: true, cells: {} };
}

/** Parses a grid note: `type: grid` frontmatter + a JSON body payload. */
export function parseGrid(markdown: string): GridModel {
  const fm = FRONTMATTER_RE.exec(markdown);
  const frontmatter = fm ? fm[1] : "type: grid";
  const body = fm ? markdown.slice(fm[0].length).trim() : markdown.trim();

  let data: GridData = {};
  try {
    data = body ? (JSON.parse(body) as GridData) : {};
  } catch {
    data = {};
  }

  const layers =
    Array.isArray(data.layers) && data.layers.length > 0 ? data.layers : [defaultLayer()];
  const activeLayer = layers.some((layer) => layer.id === data.activeLayer)
    ? (data.activeLayer as string)
    : layers[0].id;

  return {
    frontmatter,
    width: data.width ?? 16,
    height: data.height ?? 12,
    cellSize: data.cellSize ?? 28,
    layers,
    activeLayer,
    tokens: Array.isArray(data.tokens)
      ? data.tokens.map((token) => ({ ...token, layer: token.layer ?? activeLayer }))
      : [],
  };
}

export function serializeGrid(model: GridModel): string {
  const payload = {
    width: model.width,
    height: model.height,
    cellSize: model.cellSize,
    layers: model.layers,
    activeLayer: model.activeLayer,
    tokens: model.tokens,
  };
  return `---\n${model.frontmatter}\n---\n\n${JSON.stringify(payload, null, 2)}\n`;
}

export function emptyGrid(): string {
  return serializeGrid({
    frontmatter: "type: grid",
    width: 16,
    height: 12,
    cellSize: 28,
    layers: [defaultLayer()],
    activeLayer: "layer-1",
    tokens: [],
  });
}
