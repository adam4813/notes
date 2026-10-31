/**
 * Sandboxed JavaScript runtime for `run-js` note blocks.
 *
 * Scripts run inside an `<iframe sandbox="allow-scripts">` with an opaque
 * origin (no `allow-same-origin`), so guest code cannot touch the host DOM,
 * cookies, or storage. The host and guest talk over `postMessage`; the host
 * exposes a small, allowlisted, read-only scripting API (the same surface
 * plugins see) plus a dedicated output element the script may render into.
 *
 * Only pure helpers live at module scope so this file is safe to import in a
 * Node (non-DOM) test environment; everything DOM-touching is inside functions
 * invoked at runtime.
 */

/** Fenced-code language tag that marks a block as runnable (``` ```run-js ```). */
export const SANDBOX_LANGUAGE = "run-js";

/** `source` marker on messages the host sends to the sandbox. */
const HOST_SOURCE = "notes-sandbox-host";
/** `source` marker on messages the sandbox sends back to the host. */
const GUEST_SOURCE = "notes-sandbox-guest";

/** Maximum iframe height (px) the host will honor from a resize request. */
const MAX_SANDBOX_HEIGHT = 4000;

/** Active note exposed to a running script. Mirrors the plugin ActiveDocument. */
export interface ScriptActiveDocument {
  path: string;
  content: string;
  /** Note type, e.g. "markdown" | "table" | "canvas" | "board". */
  type: string;
}

/** Lightweight note reference returned by `notes.listNotes()`. */
export interface ScriptNoteRef {
  title: string;
  path: string;
}

/**
 * Read-only scripting API handed to sandboxed scripts. Methods may be sync or
 * async; the bridge awaits their results. Kept intentionally small — new
 * capabilities (e.g. a data-query tool) slot in here.
 */
export interface ScriptSandboxApi {
  /** Returns the note the script is embedded in, or null when unavailable. */
  getActiveDocument: () => ScriptActiveDocument | null | Promise<ScriptActiveDocument | null>;
  /** Lists notes in the active Tome. */
  listNotes: () => ScriptNoteRef[] | Promise<ScriptNoteRef[]>;
  /** Lists tags known to the active Tome. */
  listTags: () => string[] | Promise<string[]>;
}

/** Status reported by a sandbox run. */
export type SandboxStatus = "running" | "ok" | "error";

/** Theme tokens injected into the sandbox document for visual consistency. */
export interface SandboxTheme {
  background: string;
  foreground: string;
  muted: string;
  border: string;
  accent: string;
  fontFamily: string;
  monoFontFamily: string;
}

export const DEFAULT_SANDBOX_THEME: SandboxTheme = {
  background: "#ffffff",
  foreground: "#1a1a1a",
  muted: "#6b7280",
  border: "#d1d5db",
  accent: "#2563eb",
  fontFamily: "system-ui, sans-serif",
  monoFontFamily: "ui-monospace, monospace",
};

export interface RunScriptOptions {
  /** Host element the sandbox iframe is appended to. */
  container: HTMLElement;
  /** Script source to execute. */
  code: string;
  /** Scripting API the guest may call. */
  api: ScriptSandboxApi;
  /** Optional theme override; defaults to the current document theme. */
  theme?: SandboxTheme;
  /** Notified as the run progresses; `message` carries error text. */
  onStatus?: (status: SandboxStatus, message?: string) => void;
}

/**
 * Removes characters that could break out of a CSS value / `<style>` block,
 * while keeping colors (`#abc`, `rgb(...)`) and font lists (with quotes/commas)
 * intact. Falls back to a safe default when the result is empty or too long.
 */
export function sanitizeCssValue(value: string, fallback: string): string {
  const cleaned = value.replace(/[<>{};\\@]/g, "").trim();
  return cleaned.length > 0 && cleaned.length <= 200 ? cleaned : fallback;
}

function sanitizeTheme(theme: SandboxTheme): SandboxTheme {
  return {
    background: sanitizeCssValue(theme.background, DEFAULT_SANDBOX_THEME.background),
    foreground: sanitizeCssValue(theme.foreground, DEFAULT_SANDBOX_THEME.foreground),
    muted: sanitizeCssValue(theme.muted, DEFAULT_SANDBOX_THEME.muted),
    border: sanitizeCssValue(theme.border, DEFAULT_SANDBOX_THEME.border),
    accent: sanitizeCssValue(theme.accent, DEFAULT_SANDBOX_THEME.accent),
    fontFamily: sanitizeCssValue(theme.fontFamily, DEFAULT_SANDBOX_THEME.fontFamily),
    monoFontFamily: sanitizeCssValue(theme.monoFontFamily, DEFAULT_SANDBOX_THEME.monoFontFamily),
  };
}

/**
 * Guest bootstrap script. Runs inside the sandboxed iframe.
 *
 * IMPORTANT: embedded verbatim in a host-side template literal, so it must not
 * contain backticks, `${`, or backslashes. It sets up the postMessage bridge,
 * builds the `notes` API proxy, captures console output, auto-reports height,
 * and executes user code via the AsyncFunction constructor (top-level await).
 */
const GUEST_SCRIPT = [
  "(function () {",
  '  "use strict";',
  '  var HOST = "notes-sandbox-host";',
  '  var GUEST = "notes-sandbox-guest";',
  "  var pending = new Map();",
  "  var seq = 0;",
  '  var out = document.getElementById("notes-script-output");',
  "  function send(message) {",
  "    message.source = GUEST;",
  '    parent.postMessage(message, "*");',
  "  }",
  "  function reportSize() {",
  "    var height = Math.ceil(document.documentElement.getBoundingClientRect().height);",
  '    send({ type: "resize", height: height });',
  "  }",
  "  function format(value) {",
  '    if (typeof value === "string") return value;',
  "    if (value instanceof Error) return value.name + ': ' + value.message;",
  "    try {",
  "      return JSON.stringify(value, null, 2);",
  "    } catch (error) {",
  "      return String(value);",
  "    }",
  "  }",
  "  function appendLine(kind, args) {",
  '    var line = document.createElement("div");',
  '    line.className = "notes-log notes-log-" + kind;',
  '    line.textContent = Array.prototype.map.call(args, format).join(" ");',
  "    out.appendChild(line);",
  "  }",
  "  var sandboxConsole = {",
  '    log: function () { appendLine("log", arguments); },',
  '    info: function () { appendLine("log", arguments); },',
  '    debug: function () { appendLine("log", arguments); },',
  '    warn: function () { appendLine("warn", arguments); },',
  '    error: function () { appendLine("error", arguments); }',
  "  };",
  "  function callApi(method, args) {",
  "    return new Promise(function (resolve, reject) {",
  "      var id = ++seq;",
  "      pending.set(id, { resolve: resolve, reject: reject });",
  '      send({ type: "api-call", id: id, method: method, args: args });',
  "    });",
  "  }",
  "  function buildApi(methods) {",
  "    var proxy = {};",
  "    methods.forEach(function (name) {",
  "      proxy[name] = function () {",
  "        return callApi(name, Array.prototype.slice.call(arguments));",
  "      };",
  "    });",
  "    return proxy;",
  "  }",
  "  function fail(message) {",
  '    appendLine("error", [message]);',
  "    reportSize();",
  '    send({ type: "result", status: "error", message: message });',
  "  }",
  "  function run(code, methods) {",
  '    out.textContent = "";',
  "    var notes = buildApi(methods);",
  "    var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;",
  "    var fn;",
  "    try {",
  '      fn = new AsyncFunction("notes", "el", "console", code);',
  "    } catch (error) {",
  "      fail(error && error.message ? error.message : String(error));",
  "      return;",
  "    }",
  "    Promise.resolve()",
  "      .then(function () { return fn(notes, out, sandboxConsole); })",
  "      .then(function (result) {",
  "        if (result !== undefined) {",
  '          var pre = document.createElement("pre");',
  '          pre.className = "notes-return";',
  "          pre.textContent = format(result);",
  "          out.appendChild(pre);",
  "        }",
  "        reportSize();",
  '        send({ type: "result", status: "ok" });',
  "      })",
  "      .catch(function (error) {",
  "        fail(error && error.message ? error.message : String(error));",
  "      });",
  "  }",
  '  window.addEventListener("message", function (event) {',
  "    if (event.source !== parent) return;",
  "    var data = event.data;",
  "    if (!data || data.source !== HOST) return;",
  '    if (data.type === "run") {',
  '      run(String(data.code || ""), Array.isArray(data.methods) ? data.methods : []);',
  '    } else if (data.type === "api-result") {',
  "      var entry = pending.get(data.id);",
  "      if (!entry) return;",
  "      pending.delete(data.id);",
  "      if (data.ok) entry.resolve(data.value);",
  '      else entry.reject(new Error(data.error || "Script API error"));',
  "    }",
  "  });",
  '  if (typeof ResizeObserver === "function") {',
  "    new ResizeObserver(function () { reportSize(); }).observe(document.documentElement);",
  "  }",
  '  send({ type: "ready" });',
  "}());",
].join("\n");

/**
 * Builds the sandbox iframe document (`srcdoc`). Theme tokens are sanitized
 * before interpolation so they can't escape the `<style>` block.
 */
export function buildSandboxSrcdoc(theme: SandboxTheme = DEFAULT_SANDBOX_THEME): string {
  const t = sanitizeTheme(theme);
  return [
    "<!doctype html>",
    '<html><head><meta charset="utf-8"><style>',
    ":root{color-scheme:light dark;}",
    "html,body{margin:0;padding:0;}",
    "body{font-family:" +
      t.fontFamily +
      ";color:" +
      t.foreground +
      ";background:" +
      t.background +
      ";font-size:14px;line-height:1.5;padding:10px;box-sizing:border-box;}",
    "#notes-script-output{display:flex;flex-direction:column;gap:6px;}",
    ".notes-log{white-space:pre-wrap;word-break:break-word;font-family:" +
      t.monoFontFamily +
      ";font-size:12px;}",
    ".notes-log-warn{color:#b45309;}",
    ".notes-log-error{color:#dc2626;}",
    ".notes-return{margin:0;padding:8px;border:1px solid " +
      t.border +
      ";border-radius:6px;color:" +
      t.muted +
      ";font-family:" +
      t.monoFontFamily +
      ";font-size:12px;white-space:pre-wrap;word-break:break-word;}",
    "a{color:" + t.accent + ";}",
    "table{border-collapse:collapse;}td,th{border:1px solid " + t.border + ";padding:4px 8px;}",
    "</style></head><body><div id=\"notes-script-output\"></div><script>",
    GUEST_SCRIPT,
    "</script></body></html>",
  ].join("");
}

/**
 * Builds a dispatcher that invokes only own, function-valued methods of `api`.
 * Unknown or inherited keys (e.g. `__proto__`, `constructor`) are rejected,
 * preventing prototype-pollution style calls from guest code.
 */
export function createApiDispatcher(
  api: ScriptSandboxApi,
): (method: string, args: unknown[]) => Promise<unknown> {
  const record = api as unknown as Record<string, unknown>;
  const allowed = new Set(
    Object.keys(record).filter((key) => typeof record[key] === "function"),
  );
  return async (method: string, args: unknown[]): Promise<unknown> => {
    if (typeof method !== "string" || !allowed.has(method)) {
      throw new Error("Unknown script API method: " + String(method));
    }
    const fn = record[method] as (...callArgs: unknown[]) => unknown;
    const safeArgs = Array.isArray(args) ? args : [];
    return await fn(...safeArgs);
  };
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reads sandbox theme tokens from the host document's CSS custom properties,
 * falling back to {@link DEFAULT_SANDBOX_THEME} for any that are unset.
 */
export function readSandboxTheme(root?: HTMLElement): SandboxTheme {
  const element = root ?? document.documentElement;
  const styles = getComputedStyle(element);
  const read = (name: string, fallback: string): string => {
    const value = styles.getPropertyValue(name).trim();
    return value.length > 0 ? value : fallback;
  };
  return {
    background: read("--bg", DEFAULT_SANDBOX_THEME.background),
    foreground: read("--fg", DEFAULT_SANDBOX_THEME.foreground),
    muted: read("--fg-muted", DEFAULT_SANDBOX_THEME.muted),
    border: read("--border", DEFAULT_SANDBOX_THEME.border),
    accent: read("--accent", DEFAULT_SANDBOX_THEME.accent),
    fontFamily: read("--editor-font-family", DEFAULT_SANDBOX_THEME.fontFamily),
    monoFontFamily: read("--font-mono", DEFAULT_SANDBOX_THEME.monoFontFamily),
  };
}

interface GuestMessage {
  source?: string;
  type?: string;
  height?: number;
  id?: number;
  method?: string;
  args?: unknown[];
  status?: string;
  message?: string;
}

/**
 * Runs `code` in a freshly created sandboxed iframe appended to `container`.
 *
 * Returns a disposer that detaches the message listener and removes the iframe;
 * callers must invoke it on re-run and unmount to avoid leaks and stray
 * messages.
 */
export function runScriptInSandbox(options: RunScriptOptions): () => void {
  const { container, code, api, onStatus } = options;
  const theme = options.theme ?? readSandboxTheme();
  const record = api as unknown as Record<string, unknown>;
  const methods = Object.keys(record).filter((key) => typeof record[key] === "function");
  const dispatch = createApiDispatcher(api);

  const iframe = document.createElement("iframe");
  iframe.className = "script-block__frame";
  iframe.title = "Script output";
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.srcdoc = buildSandboxSrcdoc(theme);

  let disposed = false;

  const postToGuest = (message: Record<string, unknown>): void => {
    // Opaque-origin sandbox → targetOrigin must be "*"; the message is still
    // delivered only to this iframe's window and carries no sensitive data.
    iframe.contentWindow?.postMessage({ ...message, source: HOST_SOURCE }, "*");
  };

  const onMessage = (event: MessageEvent): void => {
    if (disposed || event.source !== iframe.contentWindow) {
      return;
    }
    const data = event.data as GuestMessage | null;
    if (!data || data.source !== GUEST_SOURCE) {
      return;
    }
    switch (data.type) {
      case "ready":
        onStatus?.("running");
        postToGuest({ type: "run", code, methods });
        break;
      case "resize": {
        const raw = Number(data.height) || 0;
        const height = Math.min(Math.max(0, raw), MAX_SANDBOX_HEIGHT);
        iframe.style.height = height + "px";
        break;
      }
      case "api-call":
        void dispatch(String(data.method), Array.isArray(data.args) ? data.args : []).then(
          (value) => postToGuest({ type: "api-result", id: data.id, ok: true, value }),
          (error) => postToGuest({ type: "api-result", id: data.id, ok: false, error: toMessage(error) }),
        );
        break;
      case "result":
        onStatus?.(data.status === "ok" ? "ok" : "error", data.message);
        break;
      default:
        break;
    }
  };

  window.addEventListener("message", onMessage);
  container.appendChild(iframe);

  return () => {
    disposed = true;
    window.removeEventListener("message", onMessage);
    iframe.remove();
  };
}
