/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
// electron-store v11 is ESM-only. We load it via require() in the CJS Electron context.
// The tsup shims make require() available in the bundled output.

const ElectronStore = require("electron-store");

interface AppConfig {
  /** Absolute path to the active Tome folder. Null until user picks one. */
  tomePath: string | null;
}

export const configStore = new ElectronStore({
  name: "notes-config",
  defaults: { tomePath: null } as AppConfig,
}) as {
  get(key: "tomePath"): string | null;
  set(key: "tomePath", value: string | null): void;
};
