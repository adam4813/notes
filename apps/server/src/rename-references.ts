import { parseCanvas, rewriteCanvasFileNodePaths, serializeCanvas } from "@notes/note-canvas";

const WIKILINK_RE = /(!?)\[\[([^\]]+?)\]\]/g;

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
  const fromTarget = stripExtension(fromPath);
  const toTarget = stripExtension(toPath);
  if (fromTarget.toLowerCase() === toTarget.toLowerCase()) {
    return content;
  }

  return content.replace(WIKILINK_RE, (match, bang: string, raw: string) => {
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
