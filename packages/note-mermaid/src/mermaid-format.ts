import { buildContent, FrontmatterProp, parseFrontmatter } from "@notes/web/src/lib/frontmatter";

export interface MermaidModel {
  frontmatter: FrontmatterProp[];
  /** The Mermaid diagram source (everything after the frontmatter). */
  source: string;
}

/** Parses a markdown-backed Mermaid note (frontmatter + diagram source body). */
export function parseMermaid(markdown: string): MermaidModel {
  const parsed = parseFrontmatter(markdown);
  return {
    frontmatter: parsed.props.length ? parsed.props : [{ key: "type", value: "mermaid" }],
    source: parsed.body,
  };
}

export function serializeMermaid(model: MermaidModel): string {
  return buildContent(model.frontmatter, model.source);
}

export function emptyMermaid(): string {
  return serializeMermaid({
    frontmatter: [{ key: "type", value: "mermaid" }],
    source: [
      "flowchart TD",
      "  A[Start] --> B{Choice}",
      "  B -->|Yes| C[Do it]",
      "  B -->|No| D[Skip]",
    ].join("\n"),
  });
}
