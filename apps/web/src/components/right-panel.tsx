import { useEffect, useState } from "react";
import { api, type Backlink } from "../api/client";
import { useWorkspace } from "../state/app-context";

interface Heading {
  level: number;
  text: string;
  key: string;
}

function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const re = /^(#{1,6})\s+(.+?)\s*$/gm;
  let match: RegExpExecArray | null;
  let counter = 0;
  while ((match = re.exec(markdown)) !== null) {
    headings.push({ level: match[1].length, text: match[2], key: `${counter++}-${match[2]}` });
  }
  return headings;
}

function scrollToHeading(text: string): void {
  const host = document.querySelector(".tiptap-host");
  if (!host) {
    return;
  }
  for (const node of Array.from(host.querySelectorAll("h1, h2, h3, h4, h5, h6"))) {
    if (node.textContent?.trim() === text.trim()) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
}

export function RightPanel() {
  const { state, dispatch } = useWorkspace();
  const activePane = state.panes.find((pane) => pane.id === state.activePaneId) ?? state.panes[0];
  const activeTab = activePane?.tabs.find((tab) => tab.id === activePane.activeTabId);
  const path = activeTab?.path;
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    if (!path) {
      setBacklinks([]);
      setHeadings([]);
      return;
    }
    let cancelled = false;
    api
      .backlinks(path)
      .then((result) => {
        if (!cancelled) {
          setBacklinks(result.backlinks);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBacklinks([]);
        }
      });
    api
      .read(path)
      .then((result) => {
        if (!cancelled) {
          setHeadings(extractHeadings(result.content));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHeadings([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <aside className="right-panel">
      <div className="panel-header">Outline</div>
      {!path && <div className="panel-empty">Open a note.</div>}
      {path && headings.length === 0 && <div className="panel-empty">No headings.</div>}
      <ul className="outline-list">
        {headings.map((heading) => (
          <li key={heading.key} style={{ paddingLeft: `${(heading.level - 1) * 10}px` }}>
            <button className="outline-item" onClick={() => scrollToHeading(heading.text)}>
              {heading.text}
            </button>
          </li>
        ))}
      </ul>

      <div className="panel-header panel-header--spaced">Backlinks</div>
      {path && backlinks.length === 0 && <div className="panel-empty">No backlinks yet.</div>}
      <ul className="backlink-list">
        {backlinks.map((backlink) => (
          <li key={backlink.path}>
            <button
              className="backlink"
              onClick={() =>
                dispatch({ type: "openFile", path: backlink.path, title: backlink.title })
              }
            >
              {backlink.title}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
