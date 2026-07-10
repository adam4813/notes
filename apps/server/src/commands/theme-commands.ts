import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ThemeMeta } from "@notes/shared";

const THEMES_DIR = ".notes/themes";

/** Directory that ships with the server binary containing bundled default themes. */
const BUNDLED_DIR = join(dirname(fileURLToPath(import.meta.url)), "../themes");

export interface ThemeEntry {
  meta: ThemeMeta;
  cssPath: string;
}

/** Reads meta.json from a theme directory, returns null if invalid/missing. */
async function readMeta(dir: string): Promise<ThemeMeta | null> {
  const metaPath = join(dir, "meta.json");
  if (!existsSync(metaPath)) return null;
  try {
    const raw = await readFile(metaPath, "utf-8");
    return JSON.parse(raw) as ThemeMeta;
  } catch {
    return null;
  }
}

/**
 * Lists all themes installed in the Tome's `.notes/themes/` directory.
 * Each sub-directory with a valid `meta.json` is treated as a theme package.
 */
export async function listTomeThemes(tomePath: string): Promise<ThemeEntry[]> {
  const themesRoot = join(tomePath, THEMES_DIR);
  if (!existsSync(themesRoot)) return [];
  const entries: ThemeEntry[] = [];
  let dirs: string[] = [];
  try {
    dirs = await readdir(themesRoot);
  } catch {
    return [];
  }
  for (const name of dirs) {
    const dir = join(themesRoot, name);
    const meta = await readMeta(dir);
    if (!meta) continue;
    const cssPath = join(dir, "theme.css");
    if (existsSync(cssPath)) {
      entries.push({ meta, cssPath });
    }
  }
  return entries;
}

/**
 * Returns the CSS content for a theme by id.
 * Returns null if the theme is not found.
 */
export async function getThemeCSS(tomePath: string, id: string): Promise<string | null> {
  const cssPath = join(tomePath, THEMES_DIR, id, "theme.css");
  if (!existsSync(cssPath)) return null;
  return readFile(cssPath, "utf-8");
}

/** Lists bundled default themes (shipped with the server). */
export async function listBundledThemes(): Promise<string[]> {
  if (!existsSync(BUNDLED_DIR)) return [];
  try {
    return readdir(BUNDLED_DIR);
  } catch {
    return [];
  }
}

/**
 * Copies all bundled default themes into the Tome's `.notes/themes/` directory.
 * Existing theme files are overwritten. Returns the list of imported theme ids.
 */
export async function importDefaultThemes(tomePath: string): Promise<string[]> {
  const bundledIds = await listBundledThemes();
  const imported: string[] = [];
  for (const id of bundledIds) {
    const src = join(BUNDLED_DIR, id);
    const dest = join(tomePath, THEMES_DIR, id);
    await mkdir(dest, { recursive: true });
    for (const file of ["meta.json", "theme.css"]) {
      const srcFile = join(src, file);
      if (existsSync(srcFile)) {
        await copyFile(srcFile, join(dest, file));
      }
    }
    imported.push(id);
  }
  return imported;
}
