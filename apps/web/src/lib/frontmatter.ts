/**
 * Minimal frontmatter read/write for the properties panel. Handles simple
 * `key: value` YAML blocks (the shape Notes writes) without a full YAML parser.
 */
import matter from "gray-matter";
import { stringify as stringifyYaml } from "yaml";

export interface FrontmatterProp {
  key: string;
  value: unknown;
}

export interface ParsedFrontmatter {
  props: FrontmatterProp[];
  body: string;
  hasBlock: boolean;
}

const BLOCK_RE = /^---\n([\s\S]*?)\n---\n*/;

export function frontmatterType(content: string): string | undefined {
  const block = BLOCK_RE.exec(content);
  if (!block) return undefined;
  const parsed = matter(content);
  return parsed.data?.type;
}

export function stripFrontmatter(content: string): string {
  return content.replace(BLOCK_RE, "").trim();
}

export function getFrontmatterField<T = string>(
  props: FrontmatterProp[],
  key: string,
): T | undefined {
  return props.find((prop) => prop.key === key)?.value as T;
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = BLOCK_RE.exec(content);
  if (!match) {
    return { props: [], body: content, hasBlock: false };
  }
  try {
    const parsed = matter(content);
    return {
      props: Object.entries(parsed.data).map(([key, value]) => ({
        key,
        value: value,
      })),
      body: parsed.content,
      hasBlock: Object.keys(parsed.data).length > 0,
    };
  } catch (e) {
    console.error("Failed to parse frontmatter:", e);
    return {
      props: [],
      body: content,
      hasBlock: false,
    };
  }
}

/** Rebuilds file content from properties + body (drops the block when empty). */
export function buildContent(props: FrontmatterProp[], body: string): string {
  const clean = props.filter((prop) => prop.key.trim().length > 0);
  if (clean.length === 0) {
    return body;
  }

  const frontmatter = stringifyYaml(
    Object.fromEntries(clean.map(({ key, value }) => [key, value])),
    {
      toStringDefaults: {
        defaultStringType: "QUOTE_SINGLE",
        defaultKeyType: "PLAIN",
      },
    },
  ).trimEnd();
  return `---\n${frontmatter}\n---\n${body}`;
}

/** Applies an edited property list to existing content, preserving the body. */
export function applyProperties(content: string, props: FrontmatterProp[]): string {
  const { body } = parseFrontmatter(content);
  return buildContent(props, body);
}
