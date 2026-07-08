const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

export interface MermaidModel {
  frontmatter: string;
  /** The Mermaid diagram source (everything after the frontmatter). */
  source: string;
}

/** Parses a markdown-backed Mermaid note (frontmatter + diagram source body). */
export function parseMermaid(markdown: string): MermaidModel {
  const fm = FRONTMATTER_RE.exec(markdown);
  const body = fm ? markdown.slice(fm[0].length) : markdown;
  const source = body.replace(/^\n+/, "").replace(/\s+$/, "");
  return { frontmatter: fm ? fm[1] : "type: mermaid", source };
}

export function serializeMermaid(model: MermaidModel): string {
  return `---\n${model.frontmatter}\n---\n\n${model.source.replace(/\s+$/, "")}\n`;
}

export function emptyMermaid(): string {
  return serializeMermaid({
    frontmatter: "type: mermaid",
    source: ["flowchart TD", "  A[Start] --> B{Choice}", "  B -->|Yes| C[Do it]", "  B -->|No| D[Skip]"].join(
      "\n",
    ),
  });
}
