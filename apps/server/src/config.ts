import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const _here = dirname(fileURLToPath(import.meta.url));

/**
 * Default Tome path:
 * - Dev (ELECTRON_DEV=1 or tsx): repo's dev-tome folder
 * - Packaged Electron: ~/Documents/Notes (overridden by electron-store in Phase 20)
 */
const DEFAULT_TOME =
  process.env["ELECTRON_DEV"] === "1" || !process.env["NOTES_PACKAGED"]
    ? resolve(_here, "../../..", "dev-tome")
    : join(homedir(), "Documents", "Notes");

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  /** Absolute path to the active Tome (folder of notes). */
  readonly tomePath: string;
}

export function loadConfig(): ServerConfig {
  const host = process.env["NOTES_HOST"] ?? "127.0.0.1";
  const port = Number(process.env["NOTES_PORT"] ?? "8787");
  const tomePath = process.env["NOTES_TOME"] ? resolve(process.env["NOTES_TOME"]) : DEFAULT_TOME;
  return { host, port, tomePath };
}
