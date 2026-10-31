import { describe, expect, it } from "vitest";
import {
  buildSandboxSrcdoc,
  createApiDispatcher,
  DEFAULT_SANDBOX_THEME,
  SANDBOX_LANGUAGE,
  sanitizeCssValue,
  type ScriptSandboxApi,
} from "./script-sandbox";

describe("SANDBOX_LANGUAGE", () => {
  it("uses the run-js fenced-code tag", () => {
    expect(SANDBOX_LANGUAGE).toBe("run-js");
  });
});

describe("sanitizeCssValue", () => {
  it("keeps colors and font lists intact", () => {
    expect(sanitizeCssValue("#1a1a1a", "x")).toBe("#1a1a1a");
    expect(sanitizeCssValue('"JetBrains Mono", monospace', "x")).toBe(
      '"JetBrains Mono", monospace',
    );
    expect(sanitizeCssValue("rgb(10, 20, 30)", "x")).toBe("rgb(10, 20, 30)");
  });

  it("strips characters that could escape a style block", () => {
    expect(sanitizeCssValue("red;} body{display:none", "fallback")).toBe("red bodydisplay:none");
    const stripped = sanitizeCssValue("</style><script>", "fallback");
    expect(stripped).not.toContain("<");
    expect(stripped).not.toContain(">");
  });

  it("falls back for empty or over-long values", () => {
    expect(sanitizeCssValue("   ", "fallback")).toBe("fallback");
    expect(sanitizeCssValue("a".repeat(201), "fallback")).toBe("fallback");
  });
});

describe("buildSandboxSrcdoc", () => {
  it("embeds the output container and guest bootstrap", () => {
    const html = buildSandboxSrcdoc();
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('id="notes-script-output"');
    expect(html).toContain("AsyncFunction");
    expect(html).toContain('send({ type: "ready" });');
    expect(html).toContain('sandbox');
  });

  it("injects sanitized theme tokens", () => {
    const html = buildSandboxSrcdoc({
      ...DEFAULT_SANDBOX_THEME,
      background: "#101010",
      accent: "#ff0000;} body{color:red",
    });
    expect(html).toContain("#101010");
    // The malicious accent value is stripped of `;`, `{`, and `}` before injection.
    expect(html).toContain("#ff0000 bodycolor:red");
    expect(html).not.toContain("} body{color:red");
  });

  it("contains no unescaped template hazards in the guest script", () => {
    const html = buildSandboxSrcdoc();
    const script = html.slice(html.indexOf("<script>") + "<script>".length);
    expect(script).not.toContain("`");
    expect(script).not.toContain("${");
  });
});

describe("createApiDispatcher", () => {
  function makeApi(): ScriptSandboxApi & { calls: unknown[][] } {
    const calls: unknown[][] = [];
    return {
      calls,
      getActiveDocument: () => ({ path: "note.md", content: "hi", type: "markdown" }),
      listNotes: (...args: unknown[]) => {
        calls.push(args);
        return [{ title: "A", path: "a.md" }];
      },
      listTags: async () => ["todo"],
    };
  }

  it("dispatches to allowlisted methods and returns their result", async () => {
    const api = makeApi();
    const dispatch = createApiDispatcher(api);
    await expect(dispatch("getActiveDocument", [])).resolves.toEqual({
      path: "note.md",
      content: "hi",
      type: "markdown",
    });
    await expect(dispatch("listTags", [])).resolves.toEqual(["todo"]);
  });

  it("forwards arguments to the method", async () => {
    const api = makeApi();
    const dispatch = createApiDispatcher(api);
    await dispatch("listNotes", ["x", 1]);
    expect(api.calls).toEqual([["x", 1]]);
  });

  it("tolerates non-array args by passing none", async () => {
    const api = makeApi();
    const dispatch = createApiDispatcher(api);
    await dispatch("listNotes", undefined as unknown as unknown[]);
    expect(api.calls).toEqual([[]]);
  });

  it("rejects unknown and inherited methods", async () => {
    const api = makeApi();
    const dispatch = createApiDispatcher(api);
    await expect(dispatch("nope", [])).rejects.toThrow(/Unknown script API method/);
    await expect(dispatch("__proto__", [])).rejects.toThrow(/Unknown script API method/);
    await expect(dispatch("constructor", [])).rejects.toThrow(/Unknown script API method/);
    await expect(dispatch("toString", [])).rejects.toThrow(/Unknown script API method/);
  });
});
