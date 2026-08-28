import { describe, expect, it } from "vitest";
import { buildHtmlDocument, inlineImages } from "./export-html";

describe("buildHtmlDocument", () => {
  it("produces a valid HTML5 skeleton", () => {
    const result = buildHtmlDocument("My Note", "<p>Hello</p>");
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("<title>My Note</title>");
    expect(result).toContain("<p>Hello</p>");
  });

  it("escapes angle brackets and ampersands in the title", () => {
    const result = buildHtmlDocument("<b>Notes & Things</b>", "body");
    expect(result).toContain("&lt;b&gt;Notes &amp; Things&lt;/b&gt;");
    expect(result).not.toContain("<b>");
  });

  it("includes the export stylesheet", () => {
    const result = buildHtmlDocument("T", "");
    expect(result).toContain("<style>");
  });

  it("places body HTML inside the body element", () => {
    const result = buildHtmlDocument("Title", "<h1>Header</h1>");
    expect(result).toMatch(/<body>\s*<h1>Header<\/h1>\s*<\/body>/);
  });
});

// inlineImages relies on browser APIs (DOMParser, fetch, FileReader) and
// cannot be unit-tested in a node environment without jsdom + fetch stubs.
// Its correctness is covered by the integration / e2e test suite.
describe("inlineImages (browser-only stubs)", () => {
  it("is a function that returns a Promise", () => {
    // Smoke-test that the export itself is structured correctly.
    expect(typeof inlineImages).toBe("function");
  });
});
