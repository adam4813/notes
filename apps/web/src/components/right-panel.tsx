import { useEffect, useState, type ReactNode } from "react";
import { api, type Backlink } from "../api/client";
import { useWorkspace } from "../state/app-context";

interface Heading {
  level: number;
  text: string;
  key: string;
}

interface Property {
  key: string;
  value: string;
}

function extractHeadings(markdown: string): Heading[] {
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const headings: Heading[] = [];
  const re = /^(#{1,6})\s+(.+?)\s*$/gm;
  let match: RegExpExecArray | null;
  let counter = 0;
  while ((match = re.exec(body)) !== null) {
    headings.push({ level: match[1].length, text: match[2], key: `${counter++}-${match[2]}` });
  }
  return headings;
}

/** Parses simple `key: value` frontmatter into displayable properties. */
function extractProperties(markdown: string): Property[] {
  const block = /^---\n([\s\S]*?)\n---/.exec(markdown);
  if (!block) {
    return [];
  }
  const properties: Property[] = [];
  for (const line of block[1].split("\n")) {
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (pair) {
      properties.push({ key: pair[1], value: pair[2] });
    }
  }
  return properties;
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="panel-section">
      <button
        className="panel-header panel-header--toggle"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((value) => !value)}
      >
        <span className="panel-caret">{collapsed ? "▸" : "▾"}</span>
        {title}
      </button>
      {!collapsed && <div className="panel-body">{children}</div>}
    </div>
  );
}

export function RightPanel() {
  const { state, dispatch } = useWorkspace();
  const activePane = state.panes.find((pane) => pane.id === state.activePaneId) ?? state.panes[0];
  const activeTab = activePane?.tabs.find((tab) => tab.id === activePane.activeTabId);
  const path = activeTab?.path;
  const isNote = Boolean(path && !path.startsWith("notes://"));
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    if (!path || !isNote) {
      setBacklinks([]);
      setHeadings([]);
      setProperties([]);
      return;
    }
    let cancelled = false;
    api
      .backlinks(path)
      .then((result) => !cancelled && setBacklinks(result.backlinks))
      .catch(() => !cancelled && setBacklinks([]));
    api
      .read(path)
      .then((result) => {
        if (!cancelled) {
          setHeadings(extractHeadings(result.content));
          setProperties(extractProperties(result.content));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHeadings([]);
          setProperties([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, isNote]);

  return (
    <aside className="right-panel">
      {!isNote && <div className="panel-empty">Open a note.</div>}

      {isNote && properties.length > 0 && (
        <Section title="Properties">
          <ul className="property-list">
            {properties.map((property) => (
              <li key={property.key} className="property-row">
                <span className="property-key">{property.key}</span>
                <span className="property-value">{property.value || "—"}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {isNote && (
        <Section title="Outline">
          {headings.length === 0 ? (
            <div className="panel-empty">No headings.</div>
          ) : (
            <ul className="outline-list">
              {headings.map((heading) => (
                <li key={heading.key} style={{ paddingLeft: `${(heading.level - 1) * 10}px` }}>
                  <button className="outline-item" onClick={() => scrollToHeading(heading.text)}>
                    {heading.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {isNote && (
        <Section title="Backlinks">
          {backlinks.length === 0 ? (
            <div className="panel-empty">No backlinks yet.</div>
          ) : (
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
          )}
        </Section>
      )}
    </aside>
  );
}
