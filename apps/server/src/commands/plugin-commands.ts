import { existsSync } from "node:fs";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { validateManifest, type PluginManifest } from "@notes/plugin-host";

const PLUGINS_DIR = ".notes/plugins";

export interface TomePluginEntry {
  manifest: PluginManifest;
  clientPath: string;
}

/**
 * Lists all plugins installed in the Tome's `.notes/plugins/` directory.
 * A valid plugin folder must contain both `manifest.json` and `client.js`.
 */
export async function listTomePlugins(tomePath: string): Promise<TomePluginEntry[]> {
  const pluginsRoot = join(tomePath, PLUGINS_DIR);
  if (!existsSync(pluginsRoot)) return [];
  let dirs: string[] = [];
  try {
    dirs = await readdir(pluginsRoot);
  } catch {
    return [];
  }
  const entries: TomePluginEntry[] = [];
  for (const name of dirs) {
    const dir = join(pluginsRoot, name);
    const manifestPath = join(dir, "manifest.json");
    const clientPath = join(dir, "client.js");
    if (!existsSync(manifestPath) || !existsSync(clientPath)) continue;
    try {
      const raw = await readFile(manifestPath, "utf-8");
      const validation = validateManifest(JSON.parse(raw) as unknown);
      if (!validation.ok || !validation.manifest) continue;
      entries.push({ manifest: validation.manifest, clientPath });
    } catch {
      // Skip plugins that have invalid manifests
    }
  }
  return entries;
}

/**
 * Returns the pre-built ESM JS source for a Tome plugin by id.
 * Returns `null` when the plugin is not found or the client script is missing.
 */
export async function getTomePluginScript(tomePath: string, id: string): Promise<string | null> {
  // Guard against path traversal.
  if (id.includes("/") || id.includes("\\") || id.includes("..")) return null;
  const clientPath = join(tomePath, PLUGINS_DIR, id, "client.js");
  if (!existsSync(clientPath)) return null;
  return readFile(clientPath, "utf-8");
}

export interface InstallPluginResult {
  ok: boolean;
  manifest?: PluginManifest;
  error?: string;
}

/**
 * Installs a plugin from a ZIP archive (provided as a Buffer).
 *
 * All files in the ZIP are extracted to `.notes/plugins/<id>/`. The ZIP must
 * contain `manifest.json` and `client.js` (at root or in a single top-level
 * folder); all other files alongside them are also extracted.
 */
export async function installPluginFromZip(
  tomePath: string,
  zipBuffer: Buffer,
): Promise<InstallPluginResult> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(zipBuffer));
  } catch {
    return { ok: false, error: "Could not read ZIP archive." };
  }

  const decoder = new TextDecoder("utf-8");
  const fileEntries = Object.entries(files);

  // Normalize paths: strip a common top-level folder if present.
  const normalised: Record<string, Uint8Array> = {};
  const prefix = detectCommonPrefix(Object.keys(files));
  for (const [path, data] of fileEntries) {
    const relative = prefix ? path.slice(prefix.length) : path;
    if (relative && !relative.endsWith("/")) normalised[relative] = data;
  }

  const manifestBytes = normalised["manifest.json"];
  const clientBytes = normalised["client.js"];

  if (!manifestBytes) return { ok: false, error: "ZIP is missing manifest.json." };
  if (!clientBytes) return { ok: false, error: "ZIP is missing client.js." };

  let manifestRaw: unknown;
  try {
    manifestRaw = JSON.parse(decoder.decode(manifestBytes));
  } catch {
    return { ok: false, error: "manifest.json is not valid JSON." };
  }

  const validation = validateManifest(manifestRaw);
  if (!validation.ok || !validation.manifest) {
    return { ok: false, error: validation.error ?? "Invalid manifest." };
  }

  const { manifest } = validation;
  const destDir = join(tomePath, PLUGINS_DIR, manifest.id);
  await mkdir(destDir, { recursive: true });

  // Extract all files from the ZIP into the plugin directory.
  for (const [relPath, data] of Object.entries(normalised)) {
    const parts = relPath.split("/");
    const fileDest = join(destDir, ...parts);
    // Ensure intermediate directories exist.
    await mkdir(join(destDir, ...parts.slice(0, -1)), { recursive: true });
    await writeFile(fileDest, data);
  }

  return { ok: true, manifest };
}

/** Detects a common path prefix (e.g. `"json-viewer/"`) across all file paths. */
function detectCommonPrefix(paths: string[]): string {
  if (paths.length === 0) return "";
  const firstSlash = paths[0].indexOf("/");
  if (firstSlash === -1) return "";
  const candidate = paths[0].slice(0, firstSlash + 1);
  if (paths.every((p) => p.startsWith(candidate))) return candidate;
  return "";
}
