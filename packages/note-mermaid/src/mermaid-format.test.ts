import { describe, expect, it } from "vitest";
import { emptyMermaid, parseMermaid, serializeMermaid } from "./mermaid-format";

describe("mermaid-format", () => {
  it("parses frontmatter and diagram source", () => {
    const model = parseMermaid("---\ntype: mermaid\n---\n\nflowchart TD\n  A --> B\n");
    expect(model.frontmatter).toContainEqual({
      key: "type",
      value: "mermaid",
    });
    expect(model.source).toBe("\nflowchart TD\n  A --> B\n");
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
    expect(emptyMermaid()).toMatch(
      "---\ntype: 'mermaid'\n---\nflowchart TD\n  A[Start] --> B{Choice}\n  B -->|Yes| C[Do it]\n  B -->|No| D[Skip]",
    );
  });
});
