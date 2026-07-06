import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/** Repo-root `dev-tome` folder, resolved independent of the process cwd. */
const DEFAULT_TOME = resolve(here, "../../..", "dev-tome");

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  /** Absolute path to the active Tome (folder of notes). */
  readonly tomePath: string;
}

export function loadConfig(): ServerConfig {
  const host = process.env.NOTES_HOST ?? "127.0.0.1";
  const port = Number(process.env.NOTES_PORT ?? "8787");
  const tomePath = process.env.NOTES_TOME ? resolve(process.env.NOTES_TOME) : DEFAULT_TOME;
  return { host, port, tomePath };
}
