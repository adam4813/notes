import DOMPurify from "dompurify";
import { marked } from "marked";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { api } from "../api/client";
import { useWorkspace } from "../state/app-context";

function renderMarkdown(source: string): string {
  const withWikilinks = source.replace(/\[\[([^\]]+?)\]\]/g, (_match, inner: string) => {
    const [target, alias] = inner.split("|");
    const name = target.split("#")[0].trim();
    const label = (alias ?? target).trim();
    return `<a href="#" class="wikilink" data-wikilink="${name}">${label}</a>`;
  });
  const html = marked.parse(withWikilinks, { async: false }) as string;
  return DOMPurify.sanitize(html, { ADD_ATTR: ["data-wikilink"] });
}

export function MarkdownPreview({ path }: { path: string }) {
  const { dispatch } = useWorkspace();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    api
      .read(path)
      .then((result) => {
        if (!cancelled) {
          setContent(result.content);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  const html = useMemo(() => renderMarkdown(content), [content]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a.wikilink");
    if (!anchor) {
      return;
    }
    event.preventDefault();
    const name = anchor.getAttribute("data-wikilink");
    if (!name) {
      return;
    }
    void api.resolve(name).then((result) => {
      if (result.path) {
        dispatch({ type: "openFile", path: result.path, title: name });
      } else {
        dispatch({ type: "setStatus", status: `No note found for "${name}"` });
      }
    });
  };

  if (error) {
    return <div className="view-error">Could not open {path}: {error}</div>;
  }

  return (
    <article className="markdown-preview">
      <div className="view-mode-hint">Reading view · editing arrives in Phase 4</div>
      <div className="markdown-body" onClick={handleClick} dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
