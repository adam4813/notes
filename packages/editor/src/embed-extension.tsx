import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import type { ReactNode } from "react";

export interface EmbedOptions {
  /** App-provided renderer for an embedded note, given its `![[target]]`. */
  renderEmbed: (target: string) => ReactNode;
}

const EMBED_LINE = /^!\[\[(.+?)\]\]$/;

function EmbedNodeView(props: NodeViewProps) {
  const target = String(props.node.attrs.target ?? "");
  const options = props.extension.options as EmbedOptions;
  return (
    <NodeViewWrapper className="note-embed" contentEditable={false} data-note-embed={target}>
      {options.renderEmbed(target)}
    </NodeViewWrapper>
  );
}

/**
 * Block-level transclusion node. A paragraph that is exactly `![[Target]]`
 * renders the target note's widget (provided by the app via `renderEmbed`) and
 * round-trips back to `![[Target]]` markdown.
 */
export const Embed = Node.create<EmbedOptions>({
  name: "noteEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { renderEmbed: () => null };
  },

  addAttributes() {
    return { target: { default: "" } };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-note-embed]",
        getAttrs: (element) => ({
          target: (element as HTMLElement).getAttribute("data-note-embed") ?? "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-note-embed": HTMLAttributes.target })];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (text: string) => void; closeBlock: (node: unknown) => void }, node: { attrs: { target: string } }) {
          state.write(`![[${node.attrs.target}]]`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedNodeView);
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /!\[\[([^\]\n]+)\]\]$/,
        type: this.type,
        getAttributes: (match) => ({ target: match[1] }),
      }),
    ];
  },

  addProseMirrorPlugins() {
    const type = this.type;
    return [
      new Plugin({
        key: new PluginKey("noteEmbedNormalize"),
        appendTransaction(_transactions, _oldState, newState) {
          const matches: { from: number; to: number; target: string }[] = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name === "paragraph") {
              const match = EMBED_LINE.exec(node.textContent.trim());
              if (match) {
                matches.push({ from: pos, to: pos + node.nodeSize, target: match[1] });
              }
              return false;
            }
            return true;
          });
          if (matches.length === 0) {
            return null;
          }
          const tr = newState.tr;
          for (const match of matches.reverse()) {
            tr.replaceWith(match.from, match.to, type.create({ target: match.target }));
          }
          return tr;
        },
      }),
    ];
  },
});
