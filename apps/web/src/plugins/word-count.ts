import type { NotesPlugin } from "@notes/plugin-host";
import { stripFrontmatter } from "@notes/web/src/lib/frontmatter";

/**
 * Sample third-party plugin (lives outside `packages/*`). It uses only the
 * public `@notes/plugin-host` API: a status-bar word counter for the active
 * note and a command. Serves as documentation-by-example.
 */
export const wordCountPlugin: NotesPlugin = {
  manifest: {
    id: "word-count",
    name: "Word Count",
    version: "1.0.0",
    description: "Shows the word count of the active note in the status bar.",
    author: "Notes sample",
    entry: { client: true },
    permissions: [],
  },
  activate(ctx) {
    const countWords = (text: string): number => {
      const body = stripFrontmatter(text);
      const matches = body.trim().match(/\S+/g);
      return matches ? matches.length : 0;
    };

    ctx.addStatusBarItem({
      id: "word-count.status",
      mount(element) {
        element.classList.add("plugin-word-count");
        const render = () => {
          const doc = ctx.document.get();
          const markdownLike = !doc || doc.type === "markdown" || doc.type === "board";
          element.textContent = doc && markdownLike ? `${countWords(doc.content)} words` : "";
        };
        render();
        return ctx.document.subscribe(render);
      },
    });

    ctx.registerCommand({
      id: "word-count.show",
      label: "Word Count: show for active note",
      defaultHotkey: "Mod+Alt+W",
      run: () => {
        const doc = ctx.document.get();
        window.alert(doc ? `${countWords(doc.content)} words in ${doc.path}` : "No note open");
      },
    });
  },
};
