import { buildContent, FrontmatterProp, parseFrontmatter } from "@notes/web/src/lib/frontmatter";

/** Default number of columns in a homepage grid. */
export const DEFAULT_COLUMNS = 12;
/** Default row height, in pixels. */
export const DEFAULT_ROW_HEIGHT = 72;

/**
 * The kinds of widget a homepage can hold. `note` embeds an existing note
 * (dropped from the explorer); `text` is a freeform, standalone widget. More
 * kinds (with their own logic) are expected over time, hence the open union.
 */
export type HomeWidgetKind = "note" | "text";

export interface HomeWidget {
  id: string;
  kind: HomeWidgetKind;
  /** Grid column of the top-left cell (0-based). */
  x: number;
  /** Grid row of the top-left cell (0-based). */
  y: number;
  /** Width in grid cells (>= 1). */
  w: number;
  /** Height in grid cells (>= 1). */
  h: number;
  /** For `note` widgets: the tome-relative path of the embedded note. */
  notePath?: string;
  /** Optional heading shown in the widget header. */
  title?: string;
  /** For `text` widgets: the freeform body. */
  text?: string;
}

export interface HomeModel {
  frontmatter: FrontmatterProp[];
  columns: number;
  rowHeight: number;
  widgets: HomeWidget[];
}

let counter = 0;
export function newId(prefix = "widget"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

interface HomeData {
  columns?: number;
  rowHeight?: number;
  widgets?: HomeWidget[];
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

/** Constrains a widget to valid, in-bounds grid coordinates for `columns`. */
export function clampWidget(widget: HomeWidget, columns: number): HomeWidget {
  const w = Math.min(columns, Math.max(1, Math.round(widget.w)));
  const h = Math.max(1, Math.round(widget.h));
  const x = Math.min(columns - w, Math.max(0, Math.round(widget.x)));
  const y = Math.max(0, Math.round(widget.y));
  return { ...widget, x, y, w, h };
}

/** Returns a copy of `widget` moved by a cell delta, clamped to the grid. */
export function moveWidget(
  widget: HomeWidget,
  dxCells: number,
  dyCells: number,
  columns: number,
): HomeWidget {
  return clampWidget({ ...widget, x: widget.x + dxCells, y: widget.y + dyCells }, columns);
}

/** Returns a copy of `widget` resized by a cell delta, clamped to the grid. */
export function resizeWidget(
  widget: HomeWidget,
  dwCells: number,
  dhCells: number,
  columns: number,
): HomeWidget {
  const w = Math.min(columns - widget.x, Math.max(1, widget.w + dwCells));
  const h = Math.max(1, widget.h + dhCells);
  return { ...widget, w, h };
}

/** Number of grid rows currently occupied (used to size the grid surface). */
export function usedRows(widgets: HomeWidget[]): number {
  return widgets.reduce((max, widget) => Math.max(max, widget.y + widget.h), 0);
}

/** Parses a homepage note: `type: home` frontmatter + a JSON body payload. */
export function parseHome(markdown: string): HomeModel {
  const parsed = parseFrontmatter(markdown);

  let data: HomeData = {};
  try {
    data = parsed.body ? (JSON.parse(parsed.body) as HomeData) : {};
  } catch {
    data = {};
  }

  const columns = clampInt(data.columns, 1, 48, DEFAULT_COLUMNS);
  const rowHeight = clampInt(data.rowHeight, 24, 480, DEFAULT_ROW_HEIGHT);
  const widgets = Array.isArray(data.widgets)
    ? data.widgets
        .filter((widget) => widget && typeof widget.id === "string")
        .map((widget) => clampWidget({ ...widget, kind: widget.kind === "note" ? "note" : "text" }, columns))
    : [];

  return {
    frontmatter: parsed.props.length > 0 ? parsed.props : [{ key: "type", value: "home" }],
    columns,
    rowHeight,
    widgets,
  };
}

export function serializeHome(model: HomeModel): string {
  const payload = {
    columns: model.columns,
    rowHeight: model.rowHeight,
    widgets: model.widgets,
  };
  return buildContent(
    [{ key: "type", value: "home" }, ...model.frontmatter.filter((prop) => prop.key !== "type")],
    JSON.stringify(payload, null, 2),
  );
}

export function emptyHome(): string {
  return serializeHome({
    frontmatter: [{ key: "type", value: "home" }],
    columns: DEFAULT_COLUMNS,
    rowHeight: DEFAULT_ROW_HEIGHT,
    widgets: [],
  });
}
