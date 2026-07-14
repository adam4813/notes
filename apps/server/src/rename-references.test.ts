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

  it("rewrites image embeds with file extensions", () => {
    const content = "Screenshot: ![[media/pasted-abc123.png]]";
    expect(
      rewriteMarkdownReferences(
        content,
        "media/pasted-abc123.png",
        "media/pasted-abc123-renamed.png",
      ),
    ).toBe("Screenshot: ![[media/pasted-abc123-renamed.png]]");
  });

  it("rewrites pasted raw-image markdown links on image rename", () => {
    const content = "![shot](/api/file/raw?path=media%2Fpasted-abc123.png)";
    expect(
      rewriteMarkdownReferences(
        content,
        "media/pasted-abc123.png",
        "media/pasted-abc123-renamed.png",
      ),
    ).toBe("![shot](/api/file/raw?path=media%2Fpasted-abc123-renamed.png)");
  });

  it("rewrites raw img-tag embeds on image rename", () => {
    const content = '<img src="/api/file/raw?path=media%2Fpasted-abc123.png" alt="shot">';
    expect(
      rewriteMarkdownReferences(
        content,
        "media/pasted-abc123.png",
        "media/pasted-abc123-renamed.png",
      ),
    ).toBe('<img src="/api/file/raw?path=media%2Fpasted-abc123-renamed.png" alt="shot">');
  });

  it("rewrites canvas file nodes on rename", () => {
    const canvas =
      '{\n  "nodes": [\n    { "id": "1", "type": "file", "x": 0, "y": 0, "width": 100, "height": 80, "file": "notes/ideas.md" }\n  ],\n  "edges": []\n}\n';
    expect(
      rewriteEmbeddedReferences("board.canvas", canvas, "notes/ideas.md", "archive/ideas.md"),
    ).toContain('"file": "archive/ideas.md"');
  });
});
