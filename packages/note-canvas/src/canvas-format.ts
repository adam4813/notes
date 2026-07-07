export type CanvasNodeType = "text" | "file" | "link" | "group";

export interface CanvasNodeBase {
  id: string;
  type: CanvasNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface TextNode extends CanvasNodeBase {
  type: "text";
  text: string;
}

export interface FileNode extends CanvasNodeBase {
  type: "file";
  file: string;
  subpath?: string;
}

export interface LinkNode extends CanvasNodeBase {
  type: "link";
  url: string;
}

export interface GroupNode extends CanvasNodeBase {
  type: "group";
  label?: string;
}

export type CanvasNode = TextNode | FileNode | LinkNode | GroupNode;

export interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: string;
  toSide?: string;
  color?: string;
  label?: string;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

/** Parses JSONCanvas text; malformed input yields an empty canvas. */
export function parseCanvas(text: string): CanvasData {
  try {
    const data = JSON.parse(text) as Partial<CanvasData>;
    return {
      nodes: Array.isArray(data.nodes) ? (data.nodes as CanvasNode[]) : [],
      edges: Array.isArray(data.edges) ? (data.edges as CanvasEdge[]) : [],
    };
  } catch {
    return { nodes: [], edges: [] };
  }
}

/** Serializes to pretty-printed JSONCanvas. */
export function serializeCanvas(data: CanvasData): string {
  return `${JSON.stringify({ nodes: data.nodes, edges: data.edges }, null, 2)}\n`;
}

export function emptyCanvas(): string {
  return serializeCanvas({ nodes: [], edges: [] });
}
