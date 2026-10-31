import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  runScriptInSandbox,
  SANDBOX_LANGUAGE,
  type SandboxStatus,
  type ScriptSandboxApi,
} from "./script-sandbox";

/** No-op scripting API used when no host API is provided (standalone/tests). */
const NO_API: ScriptSandboxApi = {
  getActiveDocument: () => null,
  listNotes: () => [],
  listTags: () => [],
};

/**
 * Supplies the host scripting API to sandboxed `run-js` blocks. The rendered
 * editor wraps its `<EditorContent>` in a provider; node views (which inherit
 * context from that tree) read the current API here. Defaults to {@link NO_API}.
 */
export const ScriptSandboxApiContext = createContext<ScriptSandboxApi>(NO_API);

type ViewStatus = SandboxStatus | "idle";

function ScriptBlockNodeView(props: NodeViewProps) {
  const code = String(props.node.attrs.content ?? "");
  const api = useContext(ScriptSandboxApiContext);
  const outputRef = useRef<HTMLDivElement>(null);
  const disposeRef = useRef<(() => void) | undefined>(undefined);
  const [status, setStatus] = useState<ViewStatus>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);

  // External-resource teardown: dispose any running sandbox on unmount.
  useEffect(() => () => disposeRef.current?.(), []);

  const run = () => {
    const host = outputRef.current;
    if (!host) {
      return;
    }
    disposeRef.current?.();
    host.replaceChildren();
    setMessage(undefined);
    setStatus("running");
    disposeRef.current = runScriptInSandbox({
      container: host,
      code,
      api,
      onStatus: (next, text) => {
        setStatus(next);
        setMessage(text);
      },
    });
  };

  return (
    <NodeViewWrapper className="script-block" contentEditable={false}>
      <div className="script-block__bar">
        <span className="script-block__label">{SANDBOX_LANGUAGE}</span>
        <button
          type="button"
          className="script-block__run"
          onClick={run}
          disabled={status === "running"}
        >
          {status === "running" ? "Running…" : "Run ▶"}
        </button>
        {status === "error" && (
          <span className="script-block__status script-block__status--error">
            {message ?? "Error"}
          </span>
        )}
        {status === "ok" && <span className="script-block__status">Done</span>}
      </div>
      <pre className="script-block__code">
        <code>{code}</code>
      </pre>
      <div className="script-block__output" ref={outputRef} />
    </NodeViewWrapper>
  );
}

/**
 * TipTap extension that renders ` ```run-js ... ``` ` fenced code blocks as an
 * interactive, sandboxed script runner in the WYSIWYG (rendered) editor.
 *
 * The code is authored as a normal fenced block (edit it in source/split mode);
 * in rendered mode it becomes a read-only preview with a Run button that
 * executes the script inside an isolated iframe. Markdown round-trips back to
 * the original ` ```run-js ``` ` fence.
 *
 * Markdown syntax:
 * ```
 * \`\`\`run-js
 * const doc = await notes.getActiveDocument();
 * console.log(doc?.path);
 * \`\`\`
 * ```
 */
export const ScriptBlockExtension = Node.create({
  name: "scriptBlock",
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
        tag: "div[data-script-block]",
        getAttrs: (element) => ({
          content: (element as HTMLElement).getAttribute("data-script-block") ?? "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-script-block": HTMLAttributes.content as string })];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (text: string) => void; closeBlock: (node: unknown) => void },
          node: { attrs: { content: string } },
        ) {
          state.write("```" + SANDBOX_LANGUAGE + "\n" + node.attrs.content + "\n```");
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ScriptBlockNodeView);
  },

  addProseMirrorPlugins() {
    const type = this.type;
    return [
      new Plugin({
        key: new PluginKey("scriptBlockNormalize"),
        appendTransaction(_transactions, _oldState, newState) {
          const matches: { from: number; to: number; content: string }[] = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name === "codeBlock" && node.attrs.language === SANDBOX_LANGUAGE) {
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
