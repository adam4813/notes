import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";

interface AppConfig {
  tomePath: string | null;
}

const DEFAULT_CONFIG: AppConfig = { tomePath: null };

function configFilePath(): string {
  return join(app.getPath("userData"), "notes-config.json");
}

function readConfig(): AppConfig {
  try {
    const filePath = configFilePath();
    if (!existsSync(filePath)) return { ...DEFAULT_CONFIG };
    const raw = readFileSync(filePath, "utf8");
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<AppConfig>) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(config: AppConfig): void {
  try {
    const filePath = configFilePath();
    mkdirSync(app.getPath("userData"), { recursive: true });
    writeFileSync(filePath, JSON.stringify(config, null, 2), "utf8");
  } catch {
    // Ignore write errors — app continues without persisted config
  }
}

/** Simple synchronous key-value store backed by a JSON file in userData. */
export const configStore = {
  get(key: "tomePath"): string | null {
    return readConfig()[key];
  },
  set(key: "tomePath", value: string | null): void {
    const config = readConfig();
    config[key] = value;
    writeConfig(config);
  },
};
