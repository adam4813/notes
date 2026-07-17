import { basename } from "node:path";
import { FrontmatterProp, parseFrontmatter } from "@notes/web/src/lib/frontmatter";

export interface ParsedLink {
  target: string;
  alias?: string;
  heading?: string;
}

export interface ParsedNote {
  path: string;
  title: string;
  type: string;
  frontmatter: FrontmatterProp[];
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

export function extractTags(body: string, props: FrontmatterProp[]): string[] {
  const tags = new Set<string>();
  for (const match of body.matchAll(TAG_RE)) {
    tags.add(match[1]);
  }

  const frontmatterTags = props.find((prop) => prop.key === "tags")?.value;
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

function deriveTitle(path: string, frontmatter: FrontmatterProp[], body: string): string {
  const titleProp = frontmatter.find((prop) => prop.key === "title")?.value;
  if (typeof titleProp === "string" && titleProp.trim()) {
    return titleProp.trim();
  }
  const h1 = body.match(H1_RE);
  if (h1) {
    return h1[1].trim();
  }
  return basename(path).replace(/\.[^.]+$/, "");
}

export function parseNote(path: string, content: string): ParsedNote {
  if (path.toLowerCase().endsWith(".canvas")) {
    return {
      path,
      title: basename(path).replace(/\.[^.]+$/, ""),
      type: "canvas",
      frontmatter: [],
      tags: [],
      links: [],
      bodyText: "",
    };
  }

  const { props, body } = parseFrontmatter(content);
  const type = (props.find((prop) => prop.key === "type")?.value as string) ?? "markdown";

  return {
    path,
    title: deriveTitle(path, props, body),
    type,
    frontmatter: props,
    tags: extractTags(body, props),
    links: extractWikilinks(body),
    bodyText: body,
  };
}
