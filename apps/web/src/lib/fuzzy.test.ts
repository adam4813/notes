import { describe, expect, it } from "vitest";
import { fuzzyMatch, fuzzyRank } from "./fuzzy";

describe("fuzzyMatch", () => {
  it("matches subsequences and records indices", () => {
    const match = fuzzyMatch("nte", "New Table");
    expect(match).not.toBeNull();
    expect(match?.indices).toEqual([0, 4, 8]);
  });

  it("returns null when the query is not a subsequence", () => {
    expect(fuzzyMatch("zzz", "New Table")).toBeNull();
  });

  it("treats an empty query as a match", () => {
    expect(fuzzyMatch("", "anything")).toEqual({ score: 0, indices: [] });
  });

  it("scores word-boundary and consecutive matches higher", () => {
    // "ta" is consecutive and at a word boundary in "table".
    const boundary = fuzzyMatch("ta", "New Table")!;
    const scattered = fuzzyMatch("ta", "attach")!;
    expect(boundary).not.toBeNull();
    expect(scattered).not.toBeNull();
    expect(boundary.score).toBeGreaterThan(scattered.score);
  });
});

describe("fuzzyRank", () => {
  const items = ["New note", "New table", "Rebuild search index", "Open settings"];

  it("ranks better matches first", () => {
    const ranked = fuzzyRank("new", items, (item) => item);
    expect(ranked.map((r) => r.item).slice(0, 2)).toEqual(["New note", "New table"]);
  });

  it("drops non-matches", () => {
    const ranked = fuzzyRank("settings", items, (item) => item);
    expect(ranked.map((r) => r.item)).toEqual(["Open settings"]);
  });

  it("preserves original order for an empty query", () => {
    const ranked = fuzzyRank("", items, (item) => item);
    expect(ranked.map((r) => r.item)).toEqual(items);
  });
});
