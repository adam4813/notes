import { describe, expect, it } from "vitest";
import { extractTags, extractWikilinks, parseNote } from "./parse";

describe("extractWikilinks", () => {
  it("parses plain, aliased, and heading links", () => {
    const links = extractWikilinks("[[Alpha]] and [[Beta|the beta]] and [[Gamma#Intro]] and [[Delta#Sec|d]]");
    expect(links).toEqual([
      { target: "Alpha" },
      { target: "Beta", alias: "the beta" },
      { target: "Gamma", heading: "Intro" },
      { target: "Delta", alias: "d", heading: "Sec" },
    ]);
  });
});

describe("extractTags", () => {
  it("collects body and frontmatter tags without duplicates", () => {
    const tags = extractTags("Body with #inbox and #project/alpha", { tags: ["inbox", "later"] });
    expect(new Set(tags)).toEqual(new Set(["inbox", "project/alpha", "later"]));
  });
});

describe("parseNote", () => {
  it("derives the title from frontmatter, then H1, then filename", () => {
    expect(parseNote("a.md", "---\ntitle: From FM\n---\n# H1\n").title).toBe("From FM");
    expect(parseNote("b.md", "# The Heading\nbody").title).toBe("The Heading");
    expect(parseNote("notes/c.md", "no heading here").title).toBe("c");
  });

  it("reads the note type from frontmatter, defaulting to markdown", () => {
    expect(parseNote("d.md", "plain").type).toBe("markdown");
    expect(parseNote("e.md", "---\ntype: table\n---\n").type).toBe("table");
  });
});
