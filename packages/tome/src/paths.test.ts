import { describe, expect, it } from "vitest";
import { PathEscapeError, resolveWithinRoot } from "./paths";

const root = process.platform === "win32" ? "C:\\tomes\\demo" : "/tomes/demo";

describe("resolveWithinRoot", () => {
  it("resolves a nested relative path inside the root", () => {
    const resolved = resolveWithinRoot(root, "notes/hello.md");
    expect(resolved.startsWith(root)).toBe(true);
  });

  it("allows the root itself", () => {
    expect(() => resolveWithinRoot(root, ".")).not.toThrow();
  });

  it("rejects paths escaping via ..", () => {
    expect(() => resolveWithinRoot(root, "../secrets.txt")).toThrow(PathEscapeError);
  });

  it("rejects deep traversal escapes", () => {
    expect(() => resolveWithinRoot(root, "notes/../../etc/passwd")).toThrow(PathEscapeError);
  });
});
