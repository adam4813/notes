import { Mark, mergeAttributes } from "@tiptap/core";

function normalizeStyleValue(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export const StyledTextMark = Mark.create({
  name: "styledText",

  addAttributes() {
    return {
      color: { default: null },
      backgroundColor: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[style]",
        getAttrs: (element) => {
          const html = element as HTMLElement;
          const color = normalizeStyleValue(html.style.color);
          const backgroundColor = normalizeStyleValue(html.style.backgroundColor);
          if (!color && !backgroundColor) {
            return false;
          }
          return { color, backgroundColor };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { color, backgroundColor, ...rest } = HTMLAttributes as {
      color?: string | null;
      backgroundColor?: string | null;
      [key: string]: unknown;
    };
    const styleParts: string[] = [];
    if (normalizeStyleValue(color)) {
      styleParts.push(`color: ${color}`);
    }
    if (normalizeStyleValue(backgroundColor)) {
      styleParts.push(`background-color: ${backgroundColor}`);
    }
    return [
      "span",
      mergeAttributes(rest, styleParts.length > 0 ? { style: styleParts.join("; ") } : {}),
      0,
    ];
  },
});
