import { describe, expect, it } from "vitest";
import { cellKey, emptyGrid, parseGrid, serializeGrid } from "./grid-format";

describe("grid-format", () => {
  it("parses a JSON grid body with layers and tokens", () => {
    const md = serializeGrid({
      frontmatter: "type: grid",
      width: 4,
      height: 3,
      cellSize: 20,
      layers: [{ id: "layer-1", name: "Base", visible: true, cells: { [cellKey(1, 1)]: "#f00" } }],
      activeLayer: "layer-1",
      tokens: [{ id: "t1", x: 0, y: 0, label: "A", color: "#000" }],
    });
    const model = parseGrid(md);
    expect(model.width).toBe(4);
    expect(model.layers[0].cells["1,1"]).toBe("#f00");
    expect(model.tokens[0].label).toBe("A");
  });

  it("falls back to defaults on malformed body", () => {
    const model = parseGrid("---\ntype: grid\n---\n\nnot json");
    expect(model.layers).toHaveLength(1);
    expect(model.width).toBe(16);
    expect(model.activeLayer).toBe(model.layers[0].id);
  });

  it("round-trips emptyGrid", () => {
    const md = emptyGrid();
    expect(serializeGrid(parseGrid(md))).toBe(md);
  });
});
