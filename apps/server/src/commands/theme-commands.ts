import { existsSync, realpathSync } from "node:fs";
import { mkdir, readdir, readFile, copyFile } from "node:fs/promises";
import { join, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { ThemeMeta } from "@notes/shared";

const THEMES_DIR = ".notes/themes";

/** Directory that ships with the server binary containing bundled default themes. */
function bundledThemesDir(): string {
  const override = process.env["NOTES_THEMES_DIR"];
  if (override) {
    const trimmed = override.trim();
    const isSimpleDirName =
      trimmed.length > 0 &&
      trimmed !== "." &&
      trimmed !== ".." &&
      !trimmed.includes("/") &&
      !trimmed.includes("\\") &&
      !trimmed.includes("..");
    if (isSimpleDirName) {
      const safeBase = resolve(process.cwd());
      const resolved = resolve(safeBase, trimmed);
      try {
        const canonicalRoot = realpathSync(safeBase);
        const canonicalResolved = realpathSync(resolved);
        const withinSafeRoot =
          canonicalResolved === canonicalRoot ||
          canonicalResolved.startsWith(canonicalRoot + sep);
        if (withinSafeRoot && existsSync(canonicalResolved)) {
          return canonicalResolved;
        }
      } catch {
        // Invalid/non-existent path, or cannot be canonicalized: fall back to bundled themes.
      }
    }
  }
  return join(dirname(fileURLToPath(import.meta.url)), "../themes");
}

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
  const themesRoot = resolve(join(tomePath, THEMES_DIR));
  const cssPath = resolve(join(themesRoot, id, "theme.css"));
  if (!cssPath.startsWith(themesRoot + sep)) return null;
  if (!existsSync(cssPath)) return null;
  return readFile(cssPath, "utf-8");
}

/** Lists bundled default themes (shipped with the server). */
export async function listBundledThemes(): Promise<string[]> {
  const root = bundledThemesDir();
  if (!existsSync(root)) return [];
  try {
    return readdir(root);
  } catch {
    return [];
  }
}

/**
 * Copies all bundled default themes into the Tome's `.notes/themes/` directory.
 * Existing theme files are overwritten. Returns the list of imported theme ids.
 */
export async function importDefaultThemes(tomePath: string): Promise<string[]> {
  const sourceRoot = bundledThemesDir();
  const destRoot = resolve(join(tomePath, THEMES_DIR));
  const bundledIds = await listBundledThemes();
  const imported: string[] = [];
  for (const id of bundledIds) {
    const src = resolve(join(sourceRoot, id));
    if (!src.startsWith(sourceRoot + sep)) continue;
    const dest = resolve(join(destRoot, id));
    if (!dest.startsWith(destRoot + sep)) continue;
    const metaSrc = join(src, "meta.json");
    const cssSrc = join(src, "theme.css");
    if (!existsSync(metaSrc) || !existsSync(cssSrc)) {
      continue;
    }
    await mkdir(dest, { recursive: true });
    await copyFile(metaSrc, join(dest, "meta.json"));
    await copyFile(cssSrc, join(dest, "theme.css"));
    imported.push(id);
  }
  return imported;
}
