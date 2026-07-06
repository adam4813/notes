import { describe, expect, it } from "vitest";
import { NoteIndex, type IndexInputFile } from "./note-index";

function file(path: string, content: string): IndexInputFile {
  return { path, content, mtimeMs: 1 };
}

const fixture: IndexInputFile[] = [
  file("welcome.md", "# Welcome\n\nSee [[ideas]] and [[ideas|my ideas]]. #inbox #project"),
  file("notes/ideas.md", "# Ideas\n\nBacklink target. #project"),
  file("misc.md", "# Misc\n\nNothing links here. wonderful content."),
];

describe("NoteIndex", () => {
  it("indexes notes and reports backlinks resolved by basename", () => {
    const index = new NoteIndex();
    index.rebuild(fixture);

    expect(index.noteCount()).toBe(3);
    const backlinks = index.backlinksOf("notes/ideas.md");
    expect(backlinks.map((b) => b.path)).toEqual(["welcome.md"]);

    index.close();
  });

  it("returns outgoing links with alias/heading detail", () => {
    const index = new NoteIndex();
    index.rebuild(fixture);

    const links = index.outgoingLinks("welcome.md");
    expect(links).toContainEqual({ target: "ideas" });
    expect(links).toContainEqual({ target: "ideas", alias: "my ideas" });

    index.close();
  });

  it("aggregates tags and lists notes by tag", () => {
    const index = new NoteIndex();
    index.rebuild(fixture);

    const tags = Object.fromEntries(index.allTags().map((t) => [t.tag, t.count]));
    expect(tags.project).toBe(2);
    expect(tags.inbox).toBe(1);
    expect(index.notesByTag("project")).toEqual(["notes/ideas.md", "welcome.md"]);

    index.close();
  });

  it("performs full-text search with highlighted snippets", () => {
    const index = new NoteIndex();
    index.rebuild(fixture);

    const results = index.search("wonderful");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("misc.md");
    expect(results[0].snippet).toContain("<mark>wonderful</mark>");

    index.close();
  });

  it("resolves wikilinks by basename to a note path", () => {
    const index = new NoteIndex();
    index.rebuild(fixture);

    expect(index.resolveWikilink("ideas")).toBe("notes/ideas.md");
    expect(index.resolveWikilink("missing")).toBeUndefined();

    index.close();
  });

  it("incrementally updates and skips unchanged content", () => {
    const index = new NoteIndex();
    index.rebuild(fixture);

    index.upsert(file("misc.md", "# Misc\n\nNothing links here. wonderful content."));
    expect(index.noteCount()).toBe(3);

    index.upsert(file("misc.md", "# Misc\n\nNow it links to [[ideas]]."));
    expect(index.backlinksOf("notes/ideas.md").map((b) => b.path)).toEqual([
      "misc.md",
      "welcome.md",
    ]);

    index.remove("misc.md");
    expect(index.noteCount()).toBe(2);

    index.close();
  });

  it("rebuilds deterministically", () => {
    const index = new NoteIndex();
    index.rebuild(fixture);
    const first = index.allTags();
    index.rebuild(fixture);
    const second = index.allTags();
    expect(second).toEqual(first);
    expect(index.noteCount()).toBe(3);

    index.close();
  });
});
