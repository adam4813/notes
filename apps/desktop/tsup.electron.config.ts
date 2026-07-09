import { defineConfig } from "tsup";

/**
 * Bundles the Electron main process and preload script to CJS.
 * Runs from the apps/desktop/ directory.
 */
export default defineConfig({
  entry: {
    main: "src/main.ts",
    preload: "src/preload.ts",
  },
  format: ["cjs"],
  outDir: "dist-electron",
  splitting: false,
  sourcemap: true,
  external: ["electron"],
  platform: "node",
  target: "node20",
});
