import { describe, expect, it } from "vitest";
import { lineDiff, toLines } from "./line-diff";

describe("toLines", () => {
  it("returns no lines for empty text", () => {
    expect(toLines("")).toEqual([]);
  });

  it("ignores a single trailing newline", () => {
    expect(toLines("a\nb\n")).toEqual(["a", "b"]);
    expect(toLines("a\nb")).toEqual(["a", "b"]);
  });

  it("normalizes CRLF line endings", () => {
    expect(toLines("a\r\nb\r\n")).toEqual(["a", "b"]);
  });
});

describe("lineDiff", () => {
  it("reports all additions when the old text is empty", () => {
    const diff = lineDiff("", "line1\nline2\n");
    expect(diff.additions).toBe(2);
    expect(diff.deletions).toBe(0);
    expect(diff.rows).toEqual([
      { type: "add", text: "line1", newLine: 1 },
      { type: "add", text: "line2", newLine: 2 },
    ]);
  });

  it("reports all deletions when the new text is empty", () => {
    const diff = lineDiff("gone\n", "");
    expect(diff.additions).toBe(0);
    expect(diff.deletions).toBe(1);
    expect(diff.rows).toEqual([{ type: "del", text: "gone", oldLine: 1 }]);
  });

  it("keeps unchanged lines as context and marks a single edited line", () => {
    const diff = lineDiff("line1\nline2\nline3\n", "line1\nline2 changed\nline3\n");
    expect(diff.additions).toBe(1);
    expect(diff.deletions).toBe(1);
    expect(diff.rows).toEqual([
      { type: "context", text: "line1", oldLine: 1, newLine: 1 },
      { type: "del", text: "line2", oldLine: 2 },
      { type: "add", text: "line2 changed", newLine: 2 },
      { type: "context", text: "line3", oldLine: 3, newLine: 3 },
    ]);
  });

  it("detects a pure insertion in the middle", () => {
    const diff = lineDiff("a\nc\n", "a\nb\nc\n");
    expect(diff.additions).toBe(1);
    expect(diff.deletions).toBe(0);
    expect(diff.rows.map((r) => `${r.type}:${r.text}`)).toEqual([
      "context:a",
      "add:b",
      "context:c",
    ]);
  });

  it("produces no change rows for identical text", () => {
    const diff = lineDiff("same\ntext\n", "same\ntext\n");
    expect(diff.additions).toBe(0);
    expect(diff.deletions).toBe(0);
    expect(diff.rows.every((r) => r.type === "context")).toBe(true);
  });
});
