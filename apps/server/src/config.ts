export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  /** Path to the active Tome (folder of notes). */
  readonly tomePath: string;
}

export function loadConfig(): ServerConfig {
  const host = process.env.NOTES_HOST ?? "127.0.0.1";
  const port = Number(process.env.NOTES_PORT ?? "8787");
  const tomePath = process.env.NOTES_TOME ?? "./tome";
  return { host, port, tomePath };
}
