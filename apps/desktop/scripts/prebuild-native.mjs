#!/usr/bin/env node
/**
 * Prepares native Node modules pre-built for the current Electron version.
 * Run this before `npm run package:desktop`.
 *
 * Usage: node scripts/prebuild-native.mjs
 */

import { rmSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopDir = join(__dirname, "..");
const rootDir = join(desktopDir, "../..");
const stagingDir = join(desktopDir, "native-staging");

const electronVersion =
  JSON.parse((await import("node:fs")).readFileSync(join(desktopDir, "package.json"), "utf8"))
    .devDependencies?.electron ?? "31.7.7";

// Modules to copy + rebuild
const nativeModules = ["better-sqlite3"];
const pureModules = ["bindings", "file-uri-to-path"];

console.log(`Preparing native modules for Electron ${electronVersion}...`);

// Reset staging dir
rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

// Copy and rebuild native modules
for (const mod of nativeModules) {
  const src = join(rootDir, "node_modules", mod);
  const dest = join(stagingDir, mod);
  console.log(`Copying ${mod}...`);
  cpSync(src, dest, { recursive: true });

  console.log(`Rebuilding ${mod} for Electron ${electronVersion}...`);
  execSync(`npx prebuild-install --runtime electron --target ${electronVersion} --arch x64`, {
    cwd: dest,
    stdio: "inherit",
  });
}

// Copy pure JS modules
for (const mod of pureModules) {
  const src = join(rootDir, "node_modules", mod);
  const dest = join(stagingDir, mod);
  if (existsSync(src)) {
    console.log(`Copying ${mod}...`);
    cpSync(src, dest, { recursive: true });
  }
}

console.log("Native modules ready in native-staging/");
