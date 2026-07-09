#!/usr/bin/env node
/**
 * Generates icon.png, icon.ico, and icon.icns from icon.svg.
 * Run from apps/desktop/: node scripts/generate-icons.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const png2icons = require("png2icons");

const __dirname = dirname(fileURLToPath(import.meta.url));
const resourcesDir = join(__dirname, "../resources");
mkdirSync(resourcesDir, { recursive: true });

const svgPath = join(resourcesDir, "icon.svg");
const pngPath = join(resourcesDir, "icon.png");
const icoPath = join(resourcesDir, "icon.ico");
const icnsPath = join(resourcesDir, "icon.icns");

// 1. SVG → PNG (512×512)
const pngBuffer = await sharp(readFileSync(svgPath))
  .resize(512, 512)
  .png()
  .toBuffer();
writeFileSync(pngPath, pngBuffer);
console.log(`✓ icon.png (512×512)`);

// 2. PNG → ICO (Windows multi-resolution)
const icoBuffer = png2icons.createICO(pngBuffer, png2icons.BICUBIC2, 0, true, true);
if (icoBuffer) {
  writeFileSync(icoPath, icoBuffer);
  console.log(`✓ icon.ico`);
} else {
  console.error("✗ ICO generation failed");
}

// 3. PNG → ICNS (macOS)
const icnsBuffer = png2icons.createICNS(pngBuffer, png2icons.BICUBIC2, 0);
if (icnsBuffer) {
  writeFileSync(icnsPath, icnsBuffer);
  console.log(`✓ icon.icns`);
} else {
  console.error("✗ ICNS generation failed");
}

console.log("Done.");
