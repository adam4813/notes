import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PathEscapeError } from "./paths";
import { Tome } from "./tome";

let root: string;
let tome: Tome;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "notes-tome-"));
  tome = new Tome(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("Tome", () => {
  it("creates, reads, and reports existence of files", async () => {
    await tome.create("notes/hello.md", "# Hello");
    expect(await tome.exists("notes/hello.md")).toBe(true);
    expect(await tome.read("notes/hello.md")).toBe("# Hello");
  });

  it("writes atomically without leaving temp files behind", async () => {
    await tome.write("a.md", "one");
    await tome.write("a.md", "two");
    expect(await tome.read("a.md")).toBe("two");

    const tree = await tome.listTree();
    const names = tree.map((entry) => entry.name);
    expect(names).toContain("a.md");
    expect(names.some((name) => name.includes(".tmp-"))).toBe(false);
  });

  it("moves and deletes files", async () => {
    await tome.create("from.md", "x");
    await tome.move("from.md", "sub/to.md");
    expect(await tome.exists("from.md")).toBe(false);
    expect(await tome.read("sub/to.md")).toBe("x");

    await tome.delete("sub/to.md");
    expect(await tome.exists("sub/to.md")).toBe(false);
  });

  it("lists a tree with directories before files", async () => {
    await tome.create("b-note.md", "");
    await tome.create("a-folder/child.md", "");

    const tree = await tome.listTree();
    expect(tree[0]?.type).toBe("directory");
    expect(tree.map((entry) => entry.name)).toEqual(["a-folder", "b-note.md"]);
  });

  it("creates nested directories", async () => {
    await tome.mkdir("a/b/c");
    const tree = await tome.listTree();
    expect(tree.some((entry) => entry.name === "a" && entry.type === "directory")).toBe(true);
  });

  it("rejects reads that escape the root", async () => {
    await expect(tome.read("../escape.md")).rejects.toBeInstanceOf(PathEscapeError);
  });

  it("persists content that can be read back from disk directly", async () => {
    await tome.write("deep/nested/file.md", "content");
    const onDisk = await readFile(join(root, "deep", "nested", "file.md"), "utf8");
    expect(onDisk).toBe("content");
  });
});
