import { BoardView } from "@notes/note-boards";
import { CalendarView } from "@notes/note-calendar";
import { GridView } from "@notes/note-grid";
import { MermaidView } from "@notes/note-mermaid";
import { TableGrid } from "@notes/note-tables";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { connectTomeChanges } from "../api/ws";
import { useWorkspace } from "../state/app-context";

function basename(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
}

function frontmatterType(content: string): string | undefined {
  const block = /^---\n([\s\S]*?)\n---/.exec(content);
  return block ? /^type:\s*(.+)$/m.exec(block[1])?.[1].trim() : undefined;
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
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

  // Guard: board, calendar, and canvas notes cannot be embedded inline.
  if (type === "board" || type === "calendar" || type === "canvas") {
    return (
      <div className={`embed-card embed-card--${type} embed-card--blocked`}>
        <div className="embed-header">
          <span className="embed-type">{TYPE_LABEL[type] ?? type}</span>
          <span className="embed-title">{title}</span>
          <button
            className="embed-open"
            onClick={() => dispatch({ type: "openFile", path, title })}
          >
            Open ↗
          </button>
        </div>
        <div className="embed-body embed-blocked-msg">
          {type === "canvas"
            ? "Canvas notes cannot be embedded."
            : `${TYPE_LABEL[type]} notes cannot be embedded inline.`}
        </div>
      </div>
    );
  }

  const body = () => {
    switch (type) {
      case "mermaid":
        return <MermaidView value={content} onChange={save} />;
      case "table":
        return <TableGrid value={content} onChange={save} />;
      case "board":
        return (
          <BoardView
            value={content}
            onChange={save}
            path={path}
            onOpenWikilink={(name) => {
              void (async () => {
                const resolved = await api.resolve(name);
                if (resolved.path) {
                  dispatch({ type: "openFile", path: resolved.path, title: name });
                }
              })();
            }}
          />
        );
      case "calendar":
        return <CalendarView value={content} onChange={save} path={path} />;
      case "grid":
        return <GridView value={content} onChange={save} />;
      default:
        return <div className="embed-markdown">{stripFrontmatter(content) || "(empty note)"}</div>;
    }
  };

  return (
    <div className={`embed-card embed-card--${type}`}>
      <div className="embed-header">
        <span className="embed-type">{TYPE_LABEL[type] ?? type}</span>
        <span className="embed-title">{title}</span>
        <button
          className="embed-open"
          onClick={() => dispatch({ type: "openFile", path, title })}
        >
          Open ↗
        </button>
      </div>
      <div className="embed-body">{body()}</div>
    </div>
  );
}
