import { describe, expect, it } from "vitest";
import {
  clampWidget,
  DEFAULT_COLUMNS,
  emptyHome,
  moveWidget,
  parseHome,
  resizeWidget,
  serializeHome,
  usedRows,
  type HomeWidget,
} from "./home-format";

function widget(overrides: Partial<HomeWidget> = {}): HomeWidget {
  return { id: "w1", kind: "text", x: 0, y: 0, w: 4, h: 2, ...overrides };
}

describe("home-format", () => {
  it("parses a JSON home body with widgets", () => {
    const md = serializeHome({
      frontmatter: [{ key: "type", value: "home" }],
      columns: 12,
      rowHeight: 72,
      widgets: [
        { id: "a", kind: "note", notePath: "notes/todo.md", x: 0, y: 0, w: 4, h: 4 },
        { id: "b", kind: "text", title: "Hello", text: "world", x: 4, y: 0, w: 4, h: 2 },
      ],
    });
    const model = parseHome(md);
    expect(model.columns).toBe(12);
    expect(model.widgets).toHaveLength(2);
    expect(model.widgets[0].kind).toBe("note");
    expect(model.widgets[0].notePath).toBe("notes/todo.md");
    expect(model.widgets[1].title).toBe("Hello");
    expect(model.widgets[1].text).toBe("world");
  });

  it("falls back to defaults on malformed body", () => {
    const model = parseHome("---\ntype: home\n---\n\nnot json");
    expect(model.columns).toBe(DEFAULT_COLUMNS);
    expect(model.widgets).toHaveLength(0);
  });

  it("round-trips emptyHome", () => {
    const md = emptyHome();
    expect(serializeHome(parseHome(md))).toBe(md);
  });

  it("clamps widgets to the grid bounds", () => {
    expect(clampWidget(widget({ x: -5, y: -2, w: 99, h: 0 }), 12)).toMatchObject({
      x: 0,
      y: 0,
      w: 12,
      h: 1,
    });
    expect(clampWidget(widget({ x: 10, w: 6 }), 12)).toMatchObject({ x: 6, w: 6 });
  });

  it("moves widgets by cell deltas, clamped to bounds", () => {
    expect(moveWidget(widget({ x: 2, y: 2 }), 1, -1, 12)).toMatchObject({ x: 3, y: 1 });
    expect(moveWidget(widget({ x: 0, y: 0 }), -5, -5, 12)).toMatchObject({ x: 0, y: 0 });
    expect(moveWidget(widget({ x: 8, w: 4 }), 5, 0, 12)).toMatchObject({ x: 8 });
  });

  it("resizes widgets, clamped to a minimum of one cell and the right edge", () => {
    expect(resizeWidget(widget({ x: 0, w: 4, h: 2 }), 2, 1, 12)).toMatchObject({ w: 6, h: 3 });
    expect(resizeWidget(widget({ x: 0, w: 2, h: 2 }), -5, -5, 12)).toMatchObject({ w: 1, h: 1 });
    expect(resizeWidget(widget({ x: 10, w: 2 }), 5, 0, 12)).toMatchObject({ w: 2 });
  });

  it("reports the number of used rows", () => {
    expect(usedRows([])).toBe(0);
    expect(usedRows([widget({ y: 0, h: 2 }), widget({ y: 3, h: 4 })])).toBe(7);
  });
});
