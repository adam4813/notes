import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { importDefaultThemes } from "./theme-commands";

const ENV_KEY = "NOTES_THEMES_DIR";
const originalThemesDir = process.env[ENV_KEY];

afterEach(() => {
  if (originalThemesDir === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = originalThemesDir;
  }
});

describe("importDefaultThemes", () => {
  it("imports only complete bundled themes", async () => {
    const root = await mkdtemp(join(tmpdir(), "notes-theme-test-"));
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

    process.env[ENV_KEY] = bundled;
    const imported = await importDefaultThemes(tome);

    expect(imported).toEqual(["good-theme"]);
    const copiedCss = await readFile(
      join(tome, ".notes", "themes", "good-theme", "theme.css"),
      "utf8",
    );
    expect(copiedCss).toContain("--bg");
  });
});
