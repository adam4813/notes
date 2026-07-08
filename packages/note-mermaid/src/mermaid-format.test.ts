import { describe, expect, it } from "vitest";
import { emptyMermaid, parseMermaid, serializeMermaid } from "./mermaid-format";

describe("mermaid-format", () => {
  it("parses frontmatter and diagram source", () => {
    const model = parseMermaid("---\ntype: mermaid\n---\n\nflowchart TD\n  A --> B\n");
    expect(model.frontmatter).toContain("type: mermaid");
    expect(model.source).toBe("flowchart TD\n  A --> B");
  });

  it("treats bare content as source when there is no frontmatter", () => {
    expect(parseMermaid("graph LR; A-->B").source).toBe("graph LR; A-->B");
  });

  it("round-trips through serialize", () => {
    const md = emptyMermaid();
    const model = parseMermaid(md);
    expect(serializeMermaid(model)).toBe(md);
  });

  it("emptyMermaid produces a valid frontmatter block", () => {
    expect(emptyMermaid()).toMatch(/^---\ntype: mermaid\n---\n\nflowchart TD/);
  });
});
