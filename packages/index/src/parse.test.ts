import { describe, expect, it } from "vitest";
import { extractTags, extractWikilinks, parseNote } from "./parse";

describe("extractWikilinks", () => {
  it("parses plain, aliased, and heading links", () => {
    const links = extractWikilinks(
      "[[Alpha]] and [[Beta|the beta]] and [[Gamma#Intro]] and [[Delta#Sec|d]]",
    );
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

  it("falls back gracefully when frontmatter is malformed", () => {
    const parsed = parseNote("bad.md", "---\n## title: Broken\n\n# Heading\n");
    expect(parsed.title).toBe("Heading");
    expect(parsed.type).toBe("markdown");
    expect(parsed.frontmatter).toEqual({});
    expect(parsed.bodyText).toContain("# Heading");
  });

  it("treats .canvas files as canvas notes titled by filename", () => {
    const parsed = parseNote("boards/plan.canvas", '{"nodes":[],"edges":[]}');
    expect(parsed.type).toBe("canvas");
    expect(parsed.title).toBe("plan");
    expect(parsed.links).toEqual([]);
  });
});
