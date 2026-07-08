import { describe, expect, it } from "vitest";
import { findMatches, replaceAll, replaceMatch } from "./find";

describe("findMatches", () => {
  it("finds non-overlapping matches (case-insensitive by default)", () => {
    expect(findMatches("aXaXa", "x")).toEqual([
      { start: 1, end: 2 },
      { start: 3, end: 4 },
    ]);
  });

  it("respects case sensitivity", () => {
    expect(findMatches("Foo foo", "foo")).toHaveLength(2);
    expect(findMatches("Foo foo", "foo", { caseSensitive: true })).toEqual([{ start: 4, end: 7 }]);
  });

  it("returns nothing for an empty query", () => {
    expect(findMatches("anything", "")).toEqual([]);
  });
});

describe("replaceMatch", () => {
  it("replaces only the match at the given index", () => {
    expect(replaceMatch("a a a", "a", 1, "b")).toBe("a b a");
  });

  it("is a no-op when the index is out of range", () => {
    expect(replaceMatch("a", "a", 5, "b")).toBe("a");
  });
});

describe("replaceAll", () => {
  it("replaces every match", () => {
    expect(replaceAll("a-a-a", "a", "b")).toBe("b-b-b");
  });

  it("handles replacement longer than the match", () => {
    expect(replaceAll("x", "x", "yy")).toBe("yy");
  });

  it("returns the original text when there is no match", () => {
    expect(replaceAll("abc", "z", "q")).toBe("abc");
  });
});
