import { describe, expect, it } from "vitest";
import { applyProperties, buildContent, parseFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  it("parses a frontmatter block and body", () => {
    const parsed = parseFrontmatter("---\ntitle: Hi\ntags: a\n---\n# Body\n");
    expect(parsed.hasBlock).toBe(true);
    expect(parsed.props).toEqual([
      { key: "title", value: "Hi" },
      { key: "tags", value: "a" },
    ]);
    expect(parsed.body).toBe("# Body\n");
  });

  it("returns the whole content as body when there is no block", () => {
    const parsed = parseFrontmatter("# Just a note\n");
    expect(parsed.hasBlock).toBe(false);
    expect(parsed.props).toEqual([]);
    expect(parsed.body).toBe("# Just a note\n");
  });
});

describe("buildContent", () => {
  it("writes a block before the body", () => {
    expect(buildContent([{ key: "type", value: "board" }], "# B\n")).toBe(
      "---\ntype: 'board'\n---\n# B\n",
    );
  });

  it("omits the block when there are no properties", () => {
    expect(buildContent([], "# B\n")).toBe("# B\n");
  });
});

describe("applyProperties", () => {
  it("round-trips and updates properties while preserving the body", () => {
    const original = "---\ntitle: Old\n---\n# Body\n";
    const updated = applyProperties(original, [{ key: "title", value: "New" }]);
    expect(updated).toBe("---\ntitle: 'New'\n---\n# Body\n");
    expect(parseFrontmatter(updated).body).toBe("# Body\n");
  });

  it("adds a first property to a note without frontmatter", () => {
    expect(applyProperties("# Body\n", [{ key: "status", value: "draft" }])).toBe(
      "---\nstatus: 'draft'\n---\n# Body\n",
    );
  });
});
