import { Node, mergeAttributes } from "@tiptap/core";

function normalizeAttr(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}

export const ImageNode = Node.create({
  name: "image",
  inline: true,
  group: "inline",
  draggable: false,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const src = normalizeAttr(HTMLAttributes.src);
    if (!src) {
      return ["img"];
    }
    const alt = normalizeAttr(HTMLAttributes.alt);
    const title = normalizeAttr(HTMLAttributes.title);
    return [
      "img",
      mergeAttributes({
        src,
        ...(alt ? { alt } : {}),
        ...(title ? { title } : {}),
      }),
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (text: string) => void },
          node: { attrs: { src?: string | null; alt?: string | null; title?: string | null } },
        ) {
          const src = normalizeAttr(node.attrs.src);
          if (!src) {
            return;
          }
          const alt = normalizeAttr(node.attrs.alt);
          const title = normalizeAttr(node.attrs.title);
          const attrs = [`src="${escapeAttr(src)}"`];
          if (alt) {
            attrs.push(`alt="${escapeAttr(alt)}"`);
          }
          if (title) {
            attrs.push(`title="${escapeAttr(title)}"`);
          }
          state.write(`<img ${attrs.join(" ")} />`);
        },
        parse: {},
      },
    };
  },
});
