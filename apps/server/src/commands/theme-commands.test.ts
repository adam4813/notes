import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { importDefaultThemes } from "./theme-commands";

let root = "";

vi.mock("node:path", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:path")>();
  return {
    ...actual, // Keep native behavior for resolve, join, etc.
    default: {
      // @ts-expect-error It cannot see the default export. We know it exists, so spread it and disreard typescript
      ...actual.default,
      join(...args: string[]) {
        // The themes dir is hard-coded to the server's source directory structure, so we need to override it for tests
        if (args.at(-1) === "../themes") {
          return actual.join(root, "bundled");
        }
        return actual.join(...args);
      },
    },
    join(...args: string[]) {
      // The themes dir is hard-coded to the server's source directory structure, so we need to override it for tests
      if (args.at(-1) === "../themes") {
        return actual.join(root, "bundled");
      }
      return actual.join(...args);
    },
  };
});

describe("importDefaultThemes", () => {
  it("imports only complete bundled themes", async () => {
    root = await mkdtemp(join(tmpdir(), "notes-theme-test-"));
    const bundled = join(root, "bundled");
    const tome = join(root, "tome");
    await mkdir(bundled, { recursive: true });
    await mkdir(tome, { recursive: true });

    const good = join(bundled, "good-theme");
    await mkdir(good, { recursive: true });
    await writeFile(
      join(good, "meta.json"),
      JSON.stringify({ id: "good-theme", name: "Good", version: "1", colorModes: ["dark"] }),
      "utf8",
    );
    await writeFile(join(good, "theme.css"), ":root{--bg:#000;}", "utf8");

    const broken = join(bundled, "broken-theme");
    await mkdir(broken, { recursive: true });
    await writeFile(join(broken, "meta.json"), JSON.stringify({ id: "broken-theme" }), "utf8");

    const imported = await importDefaultThemes(tome);

    expect(imported).toEqual(["good-theme"]);
    const copiedCss = await readFile(
      join(tome, ".notes", "themes", "good-theme", "theme.css"),
      "utf8",
    );
    expect(copiedCss).toContain("--bg");
  });
});
