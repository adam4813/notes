import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const WIKILINK_RE = /\[\[([^\]\n]+?)\]\]/g;

/**
 * Decorates `[[wikilink]]` spans so they render as clickable links inside the
 * rendered editor (click handling is wired up by the host).
 */
export const WikilinkDecorator = Extension.create({
  name: "wikilinkDecorator",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("wikilinkDecorator"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) {
                return;
              }
              const text = node.text;
              let match: RegExpExecArray | null;
              WIKILINK_RE.lastIndex = 0;
              while ((match = WIKILINK_RE.exec(text)) !== null) {
                const from = pos + match.index;
                const to = from + match[0].length;
                const target = match[1].split("|")[0].split("#")[0].trim();
                decorations.push(
                  Decoration.inline(from, to, { class: "wikilink", "data-wikilink": target }),
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
