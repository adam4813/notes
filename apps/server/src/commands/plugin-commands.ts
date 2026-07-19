import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
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
