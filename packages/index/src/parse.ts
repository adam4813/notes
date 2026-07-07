import { basename } from "node:path";
import matter from "gray-matter";

export interface ParsedLink {
  target: string;
  alias?: string;
  heading?: string;
}

export interface ParsedNote {
  path: string;
  title: string;
  type: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  links: ParsedLink[];
  bodyText: string;
}

const WIKILINK_RE = /\[\[([^\]]+?)\]\]/g;
const TAG_RE = /(?:^|[\s(])#([A-Za-z0-9][\w/-]*)/g;
const H1_RE = /^#\s+(.+)$/m;

export function extractWikilinks(body: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  for (const match of body.matchAll(WIKILINK_RE)) {
    const raw = match[1].trim();
    const [targetPart, aliasPart] = raw.split("|");
    const [target, heading] = targetPart.split("#");
    const trimmedTarget = target.trim();
    const trimmedHeading = heading?.trim();
    if (!trimmedTarget && !trimmedHeading) {
      continue;
    }
    const link: ParsedLink = { target: trimmedTarget || raw.trim() };
    if (aliasPart?.trim()) {
      link.alias = aliasPart.trim();
    }
    if (trimmedHeading) {
      link.heading = trimmedHeading;
    }
    links.push(link);
  }
  return links;
}

export function extractTags(body: string, frontmatter: Record<string, unknown>): string[] {
  const tags = new Set<string>();
  for (const match of body.matchAll(TAG_RE)) {
    tags.add(match[1]);
  }

  const frontmatterTags = frontmatter.tags;
  if (Array.isArray(frontmatterTags)) {
    for (const tag of frontmatterTags) {
      if (typeof tag === "string" && tag.trim()) {
        tags.add(tag.trim().replace(/^#/, ""));
      }
    }
  } else if (typeof frontmatterTags === "string") {
    for (const tag of frontmatterTags.split(/[,\s]+/)) {
      if (tag) {
        tags.add(tag.replace(/^#/, ""));
      }
    }
  }

  return [...tags];
}

function deriveTitle(path: string, frontmatter: Record<string, unknown>, body: string): string {
  if (typeof frontmatter.title === "string" && frontmatter.title.trim()) {
    return frontmatter.title.trim();
  }
  const h1 = body.match(H1_RE);
  if (h1) {
    return h1[1].trim();
  }
  return basename(path).replace(/\.[^.]+$/, "");
}

function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const normalizedContent = content.replace(/^\uFEFF/, "");
  const frontmatterMatch = normalizedContent.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);

  if (!frontmatterMatch) {
    return {
      frontmatter: {},
      body: content,
    };
  }

  try {
    const parsed = matter(content);
    return {
      frontmatter: (parsed.data ?? {}) as Record<string, unknown>,
      body: parsed.content,
    };
  } catch {
    return {
      frontmatter: {},
      body: content,
    };
  }
}

export function parseNote(path: string, content: string): ParsedNote {
  if (path.toLowerCase().endsWith(".canvas")) {
    return {
      path,
      title: basename(path).replace(/\.[^.]+$/, ""),
      type: "canvas",
      frontmatter: {},
      tags: [],
      links: [],
      bodyText: "",
    };
  }

  const { frontmatter, body } = parseFrontmatter(content);
  const type = typeof frontmatter.type === "string" ? frontmatter.type : "markdown";

  return {
    path,
    title: deriveTitle(path, frontmatter, body),
    type,
    frontmatter,
    tags: extractTags(body, frontmatter),
    links: extractWikilinks(body),
    bodyText: body,
  };
}
