import { describe, expect, it } from "vitest";
import { parseTabsContent, serializeTabsContent } from "./tabs-extension";

describe("parseTabsContent", () => {
  it("parses two tabs separated by ## headings", () => {
    const input = "## Tab 1\nHello from tab one.\n\n## Tab 2\nHello from tab two.";
    const result = parseTabsContent(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ label: "Tab 1", content: "Hello from tab one." });
    expect(result[1]).toEqual({ label: "Tab 2", content: "Hello from tab two." });
  });

  it("trims surrounding whitespace from each tab's content", () => {
    const input = "## My Tab\n\n  content here  \n\n";
    const result = parseTabsContent(input);
    expect(result[0].content).toBe("content here");
  });

  it("returns empty array when no ## headings are present", () => {
    const result = parseTabsContent("just some text with no headings");
    expect(result).toHaveLength(0);
  });

  it("discards text before the first ## heading", () => {
    const input = "preamble\n\n## First\ncontent";
    const result = parseTabsContent(input);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("First");
  });

  it("preserves multi-line content within a tab", () => {
    const input = "## Tab A\nLine 1\nLine 2\n\n## Tab B\nOnly line";
    const result = parseTabsContent(input);
    expect(result[0].content).toBe("Line 1\nLine 2");
    expect(result[1].content).toBe("Only line");
  });

  it("handles a single tab", () => {
    const result = parseTabsContent("## Solo\nSingle tab content.");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ label: "Solo", content: "Single tab content." });
  });
});

describe("serializeTabsContent", () => {
  it("round-trips through parse → serialize", () => {
    const original = "## Tab 1\nContent one\n\n## Tab 2\nContent two";
    const tabs = parseTabsContent(original);
    const serialized = serializeTabsContent(tabs);
    const reparsed = parseTabsContent(serialized);
    expect(reparsed).toEqual(tabs);
  });

  it("returns empty string for empty tab array", () => {
    expect(serializeTabsContent([])).toBe("");
  });

  it("produces the expected format for a single tab", () => {
    const tabs = [{ label: "Foo", content: "bar" }];
    expect(serializeTabsContent(tabs)).toBe("## Foo\nbar");
  });
});
