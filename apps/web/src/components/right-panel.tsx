import { useEffect, useState } from "react";
import { Island, IslandBody, PanelEmpty, PanelGroup, PanelSection } from "@notes/ui";
import { api, type Backlink } from "../api/client";
import { useWorkspace } from "../state/app-context";
import { useToasts } from "../state/toast";
import { useAppServices } from "../state/app-services";
import {
  applyProperties,
  parseFrontmatter,
  type FrontmatterProp,
  stripFrontmatter,
} from "../lib/frontmatter";
import { isStandalonePath } from "../lib/standalone-handles";

const HIDDEN_FRONTMATTER_KEYS = new Set(["type", "__notes_rendered_width", "columns", "events"]);

interface Heading {
  level: number;
  text: string;
  key: string;
}

function extractHeadings(markdown: string): Heading[] {
  const body = stripFrontmatter(markdown);
  const headings: Heading[] = [];
  const re = /^(#{1,6})\s+(.+?)\s*$/gm;
  let match: RegExpExecArray | null;
  let counter = 0;
  while ((match = re.exec(body)) !== null) {
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

const OUTLINE_LEVELS = ["🗄️", "📁", "📂", "📄"];

export function RightPanel() {
  const { state, dispatch } = useWorkspace();
  const { notify } = useToasts();
  const { fileHandlers } = useAppServices();
  const activePane = state.panes.find((pane) => pane.id === state.activePaneId) ?? state.panes[0];
  const activeTab = activePane?.tabs.find((tab) => tab.id === activePane.activeTabId);
  const path = activeTab?.path;
  const isStandalone = Boolean(path && isStandalonePath(path));
  const isNote = Boolean(path && !path.startsWith("notes://") && !isStandalone);
  const isCanvas = Boolean(path?.toLowerCase().endsWith(".canvas"));
  const ext = path
    ? path.lastIndexOf(".") !== -1
      ? path.slice(path.lastIndexOf(".")).toLowerCase()
      : ""
    : "";
  const pluginHandler = fileHandlers.find((h) => h.extensions.includes(ext));
  const supportsFrontmatter = !isCanvas && (!pluginHandler || pluginHandler.supportsFrontmatter);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [content, setContent] = useState("");
  const [props, setProps] = useState<FrontmatterProp[]>([]);
  const [hiddenProps, setHiddenProps] = useState<FrontmatterProp[]>([]);
  // The structural `type` key is preserved but not user-editable.
  const [typeValue, setTypeValue] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!path || !isNote) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBacklinks([]);
      setHeadings([]);
      setContent("");
      setProps([]);
      setHiddenProps([]);
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
          setContent(result.content);
          setHeadings(extractHeadings(result.content));
          const parsed = parseFrontmatter(result.content).props;
          const hidden = parsed.filter((prop) => HIDDEN_FRONTMATTER_KEYS.has(prop.key));
          setTypeValue(hidden.find((prop) => prop.key === "type")?.value as string | undefined);
          setHiddenProps(hidden);
          setProps(parsed.filter((prop) => !HIDDEN_FRONTMATTER_KEYS.has(prop.key)));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContent("");
          setHeadings([]);
          setProps([]);
          setHiddenProps([]);
          setTypeValue(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, isNote]);

  const commitProps = async (next: FrontmatterProp[]) => {
    if (!path) {
      return;
    }
    let baseContent = content;
    let preservedHidden = hiddenProps;
    try {
      const latest = (await api.read(path)).content;
      baseContent = latest;
      const latestProps = parseFrontmatter(latest).props;
      preservedHidden = latestProps.filter((prop) => HIDDEN_FRONTMATTER_KEYS.has(prop.key));
      setHiddenProps(preservedHidden);
      setTypeValue(
        preservedHidden.find((prop) => prop.key === "type")?.value as string | undefined,
      );
    } catch {
      // Keep the in-memory snapshot when a refresh read fails.
    }
    const visible = next.filter((prop) => !HIDDEN_FRONTMATTER_KEYS.has(prop.key));
    const newContent = applyProperties(baseContent, [...preservedHidden, ...visible]);
    setContent(newContent);
    setProps(visible);
    try {
      await api.write(path, newContent);
    } catch {
      notify("Couldn't save properties", { kind: "error" });
    }
  };

  const updateProp = (index: number, patch: Partial<FrontmatterProp>) =>
    setProps((prev) => prev.map((prop, i) => (i === index ? { ...prop, ...patch } : prop)));

  const removeProp = (index: number) => {
    const next = props.filter((_, i) => i !== index);
    setProps(next);
    void commitProps(next);
  };

  const addProp = () => setProps((prev) => [...prev, { key: "", value: "" }]);

  return (
    <Island>
      <IslandBody>
        <PanelGroup>
          {!isNote && !isStandalone && <PanelEmpty>Open a note.</PanelEmpty>}

          {isStandalone && (
            <PanelSection title="Properties">
              <PanelEmpty>Properties are not available for this file.</PanelEmpty>
            </PanelSection>
          )}

          {isNote && (
            <PanelSection title="Properties">
              {!supportsFrontmatter ? (
                <PanelEmpty>
                  {pluginHandler
                    ? `${pluginHandler.label} files don't support properties.`
                    : "Properties aren't available for canvas notes."}
                </PanelEmpty>
              ) : (
                <>
                  {typeValue && (
                    <div className="property-row property-row--readonly">
                      <span className="property-key">type</span>
                      <span className="property-value">{typeValue}</span>
                      <span className="property-lock" title="Managed by the note type">
                        🔒
                      </span>
                    </div>
                  )}
                  <ul className="property-list">
                    {props.map((prop, index) => (
                      <li key={index} className="property-row property-row--edit">
                        <input
                          className="property-input property-input--key"
                          aria-label="Property name"
                          placeholder="key"
                          value={prop.key}
                          onChange={(event) => updateProp(index, { key: event.target.value })}
                          onBlur={() => void commitProps(props)}
                        />
                        <input
                          className="property-input"
                          aria-label={`Value for ${prop.key || "property"}`}
                          placeholder="value"
                          value={prop.value as string | number | undefined}
                          onChange={(event) => updateProp(index, { value: event.target.value })}
                          onBlur={() => void commitProps(props)}
                        />
                        <button
                          className="property-remove"
                          aria-label={`Remove ${prop.key || "property"}`}
                          onClick={() => removeProp(index)}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  {props.length === 0 && <PanelEmpty>No properties.</PanelEmpty>}
                  <button className="property-add" onClick={addProp}>
                    ＋ Add property
                  </button>
                </>
              )}
            </PanelSection>
          )}

          {isNote && (
            <PanelSection title="Outline">
              {headings.length === 0 ? (
                <PanelEmpty>No headings.</PanelEmpty>
              ) : (
                <ul className="outline-list">
                  {headings.map((heading) => (
                    <li key={heading.key} style={{ paddingLeft: `${(heading.level - 1) * 10}px` }}>
                      <button
                        className="outline-item"
                        onClick={() => scrollToHeading(heading.text)}
                      >
                        {OUTLINE_LEVELS[heading.level - 1]} {heading.text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PanelSection>
          )}

          {isNote && (
            <PanelSection title="Backlinks">
              {backlinks.length === 0 ? (
                <PanelEmpty>No backlinks yet.</PanelEmpty>
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
            </PanelSection>
          )}
        </PanelGroup>
      </IslandBody>
    </Island>
  );
}
