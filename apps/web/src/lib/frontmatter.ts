/**
 * Minimal frontmatter read/write for the properties panel. Handles simple
 * `key: value` YAML blocks (the shape Notes writes) without a full YAML parser.
 */

export interface FrontmatterProp {
  key: string;
  value: string;
}

export interface ParsedFrontmatter {
  props: FrontmatterProp[];
  body: string;
  hasBlock: boolean;
}

const BLOCK_RE = /^---\n([\s\S]*?)\n---\n*/;

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = BLOCK_RE.exec(content);
  if (!match) {
    return { props: [], body: content, hasBlock: false };
  }
  const props: FrontmatterProp[] = [];
  for (const line of match[1].split("\n")) {
    const pair = /^([A-Za-z0-9_-]+):\s?(.*)$/.exec(line);
    if (pair) {
      props.push({ key: pair[1], value: pair[2] });
    }
  }
  return { props, body: content.slice(match[0].length), hasBlock: true };
}

/** Rebuilds file content from properties + body (drops the block when empty). */
export function buildContent(props: FrontmatterProp[], body: string): string {
  const clean = props.filter((prop) => prop.key.trim().length > 0);
  if (clean.length === 0) {
    return body;
  }
  const yaml = clean.map((prop) => `${prop.key.trim()}: ${prop.value}`).join("\n");
  return `---\n${yaml}\n---\n\n${body}`;
}

/** Applies an edited property list to existing content, preserving the body. */
export function applyProperties(content: string, props: FrontmatterProp[]): string {
  const { body } = parseFrontmatter(content);
  return buildContent(props, body);
}
