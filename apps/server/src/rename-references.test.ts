import { describe, expect, it } from "vitest";
import { rewriteEmbeddedReferences, rewriteMarkdownReferences } from "./rename-references";

describe("rename-references", () => {
  it("rewrites markdown wikilink embeds on rename", () => {
    const content = "See [[notes/ideas]] and ![[notes/ideas|preview]] plus [[notes/ideas#Heading]]";
    expect(rewriteMarkdownReferences(content, "notes/ideas.md", "archive/ideas.md")).toBe(
      "See [[archive/ideas]] and ![[archive/ideas|preview]] plus [[archive/ideas#Heading]]",
    );
  });

  it("rewrites nested markdown references on folder move", () => {
    const content = "Use [[notes/sub/plan]] and ![[notes/sub/plan]]";
    expect(rewriteMarkdownReferences(content, "notes", "archive/notes")).toBe(
      "Use [[archive/notes/sub/plan]] and ![[archive/notes/sub/plan]]",
    );
  });

  it("rewrites canvas file nodes on rename", () => {
    const canvas =
      '{\n  "nodes": [\n    { "id": "1", "type": "file", "x": 0, "y": 0, "width": 100, "height": 80, "file": "notes/ideas.md" }\n  ],\n  "edges": []\n}\n';
    expect(rewriteEmbeddedReferences("board.canvas", canvas, "notes/ideas.md", "archive/ideas.md")).toContain(
      '"file": "archive/ideas.md"',
    );
  });
});
