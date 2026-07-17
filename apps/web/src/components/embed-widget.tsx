import { GridView } from "@notes/note-grid";
import { MermaidView } from "@notes/note-mermaid";
import { useEffect, useRef, useState } from "react";
import { frontmatterType, stripFrontmatter } from "../lib/frontmatter";
import { api } from "../api/client";
import { isImagePath } from "../lib/images";
import { connectTomeChanges } from "../api/ws";
import { useWorkspace } from "../state/app-context";

function basename(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
}

interface EmbedState {
  status: "loading" | "ready" | "missing";
  path?: string;
  content?: string;
  type?: string;
}

const TYPE_LABEL: Record<string, string> = {
  markdown: "Note",
  table: "Table",
  board: "Board",
  canvas: "Canvas",
  mermaid: "Diagram",
  calendar: "Calendar",
  grid: "Grid",
  image: "Image",
};

/** Renders an embedded note (`![[target]]`) inline: its widget + save-back. */
export function EmbedWidget({ target }: { target: string }) {
  const { dispatch } = useWorkspace();
  const [state, setState] = useState<EmbedState>({ status: "loading" });
  const contentRef = useRef("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastWriteAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      if (isImagePath(target)) {
        if (!cancelled) {
          setState({ status: "ready", path: target, type: "image" });
        }
        return;
      }
      const resolved = await api.resolve(target).catch(() => ({ path: null }));
      if (!resolved.path) {
        if (!cancelled) {
          setState({ status: "missing" });
        }
        return;
      }
      const path = resolved.path;
      const { content } = await api.read(path).catch(() => ({ content: "" }));
      if (cancelled) {
        return;
      }
      contentRef.current = content;
      const type = path.toLowerCase().endsWith(".canvas")
        ? "canvas"
        : (frontmatterType(content) ?? "markdown");
      setState({ status: "ready", path, content, type });
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  // Subscribe to file-change events so edits made in the full editor are
  // reflected here without requiring a manual re-render trigger.
  useEffect(() => {
    if (state.status !== "ready" || !state.path) return;
    const watchPath = state.path;
    return connectTomeChanges((change) => {
      if (change.path !== watchPath) return;
      // Ignore the watcher echo of our own debounced write.
      if (Date.now() - lastWriteAtRef.current < 1500) return;
      void api
        .read(watchPath)
        .then((result) => {
          if (result.content === contentRef.current) return;
          contentRef.current = result.content;
          const type = watchPath.toLowerCase().endsWith(".canvas")
            ? "canvas"
            : (frontmatterType(result.content) ?? "markdown");
          setState((prev) => ({ ...prev, content: result.content, type }));
        })
        .catch(() => undefined);
    });
  }, [state.path, state.status]);

  const save = (next: string) => {
    setState((prev) => ({ ...prev, content: next }));
    contentRef.current = next;
    const path = state.path;
    if (!path) {
      return;
    }
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      lastWriteAtRef.current = Date.now();
      void api.write(path, next).catch(() => undefined);
    }, 500);
  };

  if (state.status === "loading") {
    return <div className="embed-loading">Loading “{target}”…</div>;
  }
  if (state.status === "missing" || !state.path) {
    return <div className="embed-missing">Embedded note not found: “{target}”.</div>;
  }

  const { path, content = "", type = "markdown" } = state;
  const title = basename(path);

  const body = () => {
    switch (type) {
      case "image":
        return <img className="embed-image" src={api.fileRawUrl(path)} alt={title} />;
      case "mermaid":
        return <MermaidView value={content} onChange={save} />;
      case "grid":
        return <GridView value={content} onChange={save} />;
      case "table":
      case "board":
      case "calendar":
        return (
          <div className="embed-blocked-msg">
            {`${TYPE_LABEL[type]} notes cannot be embedded inline.`}
          </div>
        );
      default:
        return <div className="embed-markdown">{stripFrontmatter(content) || "(empty note)"}</div>;
    }
  };

  return (
    <div className="embed-card">
      <div className="embed-header">
        <span className="embed-type">{TYPE_LABEL[type] ?? type}</span>
        <span className="embed-title">{title}</span>
        <button className="embed-open" onClick={() => dispatch({ type: "openFile", path, title })}>
          Open ↗
        </button>
      </div>
      <div className="embed-body">{body()}</div>
    </div>
  );
}
