/**
 * JSON Viewer — a Tome-installable Notes plugin.
 *
 * Registers a file-type handler for `.json` files that:
 *   - Renders the file with pretty-printed JSON in the full editor pane.
 *   - Renders a compact embed view for `![[file.json]]` transclusions.
 *   - Declares `supportsFrontmatter: false` so the Properties panel skips
 *     frontmatter editing for JSON files.
 *
 * Installation: place this folder at `.notes/plugins/json-viewer/` inside
 * your Tome and restart the app. Then enable the plugin from Settings.
 */

/** Syntax-highlight JSON text and return an HTML string (no external deps). */
function syntaxHighlight(json) {
  const escaped = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    function (match) {
      let cls = "json-num";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "json-key" : "json-str";
      } else if (/true|false/.test(match)) {
        cls = "json-bool";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return '<span class="' + cls + '">' + match + "</span>";
    },
  );
}

/** Injects the shared CSS once, idempotent. */
function ensureStyles() {
  if (document.getElementById("json-viewer-styles")) return;
  const style = document.createElement("style");
  style.id = "json-viewer-styles";
  style.textContent = [
    ".json-viewer-pre { margin: 0; padding: 1.25rem; font-family: var(--font-mono, 'Fira Code', monospace); font-size: 0.875em; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: var(--text, inherit); }",
    ".json-viewer-error { color: var(--error, #b91c1c); }",
    ".json-embed-wrap { font-family: var(--font-mono, monospace); font-size: 0.8em; max-height: 14rem; overflow: auto; padding: 0.5rem; border-radius: 0.25rem; background: var(--surface-2, rgba(128,128,128,0.06)); }",
    ".json-embed-pre { margin: 0; white-space: pre-wrap; word-break: break-all; }",
    ".json-key  { color: var(--token-key,  #0f172a); font-weight: 600; }",
    ".json-str  { color: var(--token-str,  #15803d); }",
    ".json-num  { color: var(--token-num,  #b45309); }",
    ".json-bool { color: var(--token-bool, #7c3aed); }",
    ".json-null { color: var(--token-null, #6b7280); }",
  ].join("\n");
  document.head.appendChild(style);
}

const jsonViewerPlugin = {
  manifest: {
    id: "json-viewer",
    name: "JSON Viewer",
    version: "1.0.0",
    description:
      "Renders .json files with pretty-printing. Does not support frontmatter properties.",
    author: "Notes",
    entry: { client: true },
    permissions: [],
  },

  activate(ctx) {
    ensureStyles();

    ctx.registerFileHandler({
      extensions: [".json"],
      label: "JSON",
      supportsFrontmatter: false,

      mountEditor(element, { content }) {
        const pre = document.createElement("pre");
        pre.className = "json-viewer-pre";
        element.appendChild(pre);

        try {
          const parsed = JSON.parse(content);
          pre.innerHTML = syntaxHighlight(JSON.stringify(parsed, null, 2));
        } catch (err) {
          pre.className = "json-viewer-pre json-viewer-error";
          pre.textContent = content + "\n\n\u26a0 Parse error: " + String(err);
        }
      },

      mountEmbed(element, { content }) {
        const wrap = document.createElement("div");
        wrap.className = "json-embed-wrap";
        const pre = document.createElement("pre");
        pre.className = "json-embed-pre";
        wrap.appendChild(pre);
        element.appendChild(wrap);

        try {
          const parsed = JSON.parse(content);
          pre.innerHTML = syntaxHighlight(JSON.stringify(parsed, null, 2));
        } catch (err) {
          pre.style.color = "var(--error, #b91c1c)";
          pre.textContent = content + "\n\n\u26a0 " + String(err);
        }
      },
    });
  },
};

export default jsonViewerPlugin;
