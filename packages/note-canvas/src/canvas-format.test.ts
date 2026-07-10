import { describe, expect, it } from "vitest";
import {
  emptyCanvas,
  parseCanvas,
  rewriteCanvasFileNodePaths,
  serializeCanvas,
  type CanvasData,
} from "./canvas-format";

describe("canvas-format", () => {
  it("round-trips nodes and edges", () => {
    const data: CanvasData = {
      nodes: [
        { id: "a", type: "text", x: 0, y: 0, width: 200, height: 100, text: "Hello" },
        { id: "b", type: "file", x: 300, y: 0, width: 200, height: 120, file: "notes/ideas.md" },
        { id: "c", type: "link", x: 0, y: 200, width: 200, height: 80, url: "https://example.com" },
      ],
      edges: [{ id: "e1", fromNode: "a", toNode: "b", label: "relates" }],
    };
    expect(parseCanvas(serializeCanvas(data))).toEqual(data);
  });

  it("returns an empty canvas for malformed input", () => {
    expect(parseCanvas("not json")).toEqual({ nodes: [], edges: [] });
  });

  it("produces a valid empty canvas", () => {
    expect(parseCanvas(emptyCanvas())).toEqual({ nodes: [], edges: [] });
  });

  it("rewrites file node paths on rename", () => {
    const data: CanvasData = {
      nodes: [
        { id: "a", type: "file", x: 0, y: 0, width: 200, height: 100, file: "notes/ideas.md" },
        {
          id: "b",
          type: "file",
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          file: "notes/sub/plan.md",
        },
      ],
      edges: [],
    };

    expect(rewriteCanvasFileNodePaths(data, "notes/ideas.md", "archive/ideas.md")).toEqual({
      ...data,
      nodes: [
        { ...data.nodes[0], file: "archive/ideas.md" },
        data.nodes[1],
      ],
    });

    expect(rewriteCanvasFileNodePaths(data, "notes", "archive")).toEqual({
      ...data,
      nodes: [
        { ...data.nodes[0], file: "archive/ideas.md" },
        { ...data.nodes[1], file: "archive/sub/plan.md" },
      ],
    });
  });
});
