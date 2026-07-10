import { parseCanvas, rewriteCanvasFileNodePaths, serializeCanvas } from "@notes/note-canvas";

const WIKILINK_RE = /(!?)\[\[([^\]]+?)\]\]/g;
const RAW_IMAGE_RE = /!\[([^\]]*)\]\(\/api\/file\/raw\?path=([^)\s]+)\)/g;
const RAW_IMG_TAG_RE = /<img([^>]*?)src="\/api\/file\/raw\?path=([^"]+)"([^>]*)>/g;

function stripExtension(path: string): string {
  return path.replace(/\.[^.]+$/, "");
}

function rewriteTarget(target: string, fromPath: string, toPath: string): string | null {
  const lower = target.toLowerCase();
  const sourceForms = [fromPath, stripExtension(fromPath)];
  const targetForms = [toPath, stripExtension(toPath)];

  for (let index = 0; index < sourceForms.length; index += 1) {
    const source = sourceForms[index];
    const replacement = targetForms[index];
    const sourceLower = source.toLowerCase();
    if (lower === sourceLower) {
      return replacement;
    }
    const prefix = `${sourceLower}/`;
    if (lower.startsWith(prefix)) {
      return `${replacement}/${target.slice(source.length + 1)}`;
    }
  }
  return null;
}

export function rewriteMarkdownReferences(
  content: string,
  fromPath: string,
  toPath: string,
): string {
  if (fromPath.toLowerCase() === toPath.toLowerCase()) {
    return content;
  }

  const withWikilinks = content.replace(WIKILINK_RE, (match, bang: string, raw: string) => {
    const [targetPart, aliasPart] = raw.split("|");
    const [target, ...headingParts] = targetPart.split("#");
    const nextTarget = rewriteTarget(target.trim(), fromPath, toPath);
    if (!nextTarget) {
      return match;
    }
    const heading = headingParts.length > 0 ? `#${headingParts.join("#")}` : "";
    const alias = aliasPart?.trim() ? `|${aliasPart.trim()}` : "";
    return `${bang}[[${nextTarget}${heading}${alias}]]`;
  });

  const withMarkdownRaw = withWikilinks.replace(RAW_IMAGE_RE, (match, alt: string, encodedPath: string) => {
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(encodedPath);
    } catch {
      decodedPath = encodedPath;
    }
    const nextTarget = rewriteTarget(decodedPath, fromPath, toPath);
    if (!nextTarget) {
      return match;
    }
    return `![${alt}](/api/file/raw?path=${encodeURIComponent(nextTarget)})`;
  });

  return withMarkdownRaw.replace(
    RAW_IMG_TAG_RE,
    (match, before: string, encodedPath: string, after: string) => {
      let decodedPath: string;
      try {
        decodedPath = decodeURIComponent(encodedPath);
      } catch {
        decodedPath = encodedPath;
      }
      const nextTarget = rewriteTarget(decodedPath, fromPath, toPath);
      if (!nextTarget) {
        return match;
      }
      return `<img${before}src="/api/file/raw?path=${encodeURIComponent(nextTarget)}"${after}>`;
    },
  );
}

export function rewriteEmbeddedReferences(
  path: string,
  content: string,
  fromPath: string,
  toPath: string,
): string {
  if (path.toLowerCase().endsWith(".canvas")) {
    const parsed = parseCanvas(content);
    const rewritten = rewriteCanvasFileNodePaths(parsed, fromPath, toPath);
    return rewritten === parsed ? content : serializeCanvas(rewritten);
  }
  if (path.toLowerCase().endsWith(".md")) {
    return rewriteMarkdownReferences(content, fromPath, toPath);
  }
  return content;
}
