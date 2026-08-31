import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useState } from "react";

export interface TabEntry {
  label: string;
  content: string;
}

/**
 * Parses tab-fenced content (`\`\`\`tabs ... \`\`\``) into an array of
 * `{ label, content }` pairs.  Tabs are delimited by lines starting with
 * `## ` (level-2 heading); everything before the first heading is discarded.
 *
 * Example:
 * ```
 * ## Tab 1
 * Body of tab 1.
 *
 * ## Tab 2
 * Body of tab 2.
 * ```
 */
export function parseTabsContent(raw: string): TabEntry[] {
  const lines = raw.split("\n");
  const tabs: TabEntry[] = [];
  let currentLabel = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ") || line.startsWith("##\t")) {
      const label = line.slice(2).trim();
      if (currentLabel) {
        tabs.push({ label: currentLabel, content: currentLines.join("\n").trim() });
      }
      currentLabel = label;
      currentLines = [];
    } else if (currentLabel) {
      currentLines.push(line);
    }
  }
  if (currentLabel) {
    tabs.push({ label: currentLabel, content: currentLines.join("\n").trim() });
  }
  return tabs;
}

/**
 * Serialises an array of tab entries back to the fenced-block body.
 */
export function serializeTabsContent(tabs: TabEntry[]): string {
  return tabs.map((tab) => `## ${tab.label}\n${tab.content}`).join("\n\n");
}

function TabGroupNodeView(props: NodeViewProps) {
  const raw = String(props.node.attrs.content ?? "");
  const tabs = parseTabsContent(raw);
  const [activeIndex, setActiveIndex] = useState(0);

  if (tabs.length === 0) {
    return (
      <NodeViewWrapper className="tab-group" contentEditable={false}>
        <div className="tab-group__empty">(empty tab group)</div>
      </NodeViewWrapper>
    );
  }

  const safeIndex = Math.min(activeIndex, tabs.length - 1);
  const activeTab = tabs[safeIndex];

  return (
    <NodeViewWrapper className="tab-group" contentEditable={false}>
      <div className="tab-group__bar" role="tablist">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            role="tab"
            aria-selected={i === safeIndex}
            className={`tab-group__tab${i === safeIndex ? " tab-group__tab--active" : ""}`}
            onClick={() => setActiveIndex(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        className="tab-group__panel"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(activeTab?.content ?? "") }}
      />
    </NodeViewWrapper>
  );
}

/**
 * Very lightweight markdown-to-HTML converter for tab panel content.
 * Handles the most common inline elements so tab bodies render nicely
 * without pulling in a full parser.
 */
function markdownToHtml(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      // Fenced code block (```...```)
      const fence = /^```(?:\w+)?\n([\s\S]*?)```$/.exec(trimmed);
      if (fence) {
        return `<pre><code>${fence[1]}</code></pre>`;
      }
      // Unordered list
      if (/^[*\-] /m.test(trimmed)) {
        const items = trimmed
          .split("\n")
          .filter((l) => /^[*\-] /.test(l))
          .map((l) => `<li>${inlineMarkdown(l.replace(/^[*\-] /, ""))}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      // Ordered list
      if (/^\d+\. /m.test(trimmed)) {
        const items = trimmed
          .split("\n")
          .filter((l) => /^\d+\. /.test(l))
          .map((l) => `<li>${inlineMarkdown(l.replace(/^\d+\. /, ""))}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }
      // Headings
      const hashEnd = trimmed.search(/[^#]/);
      if (hashEnd > 0 && hashEnd <= 6 && (trimmed[hashEnd] === " " || trimmed[hashEnd] === "\t")) {
        const level = hashEnd;
        const text = trimmed.slice(hashEnd + 1).trim();
        return `<h${level}>${inlineMarkdown(text)}</h${level}>`;
      }
      // Blockquote
      if (trimmed.startsWith("&gt;")) {
        const inner = trimmed
          .split("\n")
          .map((l) => l.replace(/^&gt;\s?/, ""))
          .join("<br>");
        return `<blockquote>${inner}</blockquote>`;
      }
      // Paragraph (single line-breaks within become <br>)
      return `<p>${inlineMarkdown(trimmed.replace(/\n/g, "<br>"))}</p>`;
    })
    .filter(Boolean);

  return paragraphs.join("\n");
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

/**
 * TipTap extension that renders ` ```tabs ... ``` ` fenced code blocks as an
 * interactive tabbed-panel component in the WYSIWYG (rendered) editor.
 *
 * Markdown syntax:
 * ```
 * \`\`\`tabs
 * ## Tab 1
 * Content for the first tab.
 *
 * ## Tab 2
 * Content for the second tab.
 * \`\`\`
 * ```
 */
export const TabGroupExtension = Node.create({
  name: "tabGroup",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return { content: { default: "" } };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-tab-group]",
        getAttrs: (element) => ({
          content: (element as HTMLElement).getAttribute("data-tab-group") ?? "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-tab-group": HTMLAttributes.content as string })];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (text: string) => void; closeBlock: (node: unknown) => void },
          node: { attrs: { content: string } },
        ) {
          state.write("```tabs\n" + node.attrs.content + "\n```");
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(TabGroupNodeView);
  },

  addProseMirrorPlugins() {
    const type = this.type;
    return [
      new Plugin({
        key: new PluginKey("tabGroupNormalize"),
        appendTransaction(_transactions, _oldState, newState) {
          const matches: { from: number; to: number; content: string }[] = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name === "codeBlock" && node.attrs.language === "tabs") {
              matches.push({ from: pos, to: pos + node.nodeSize, content: node.textContent });
              return false;
            }
            return true;
          });
          if (matches.length === 0) {
            return null;
          }
          const tr = newState.tr;
          for (const match of matches.reverse()) {
            tr.replaceWith(match.from, match.to, type.create({ content: match.content }));
          }
          return tr;
        },
      }),
    ];
  },
});
