import { defineConfig } from "tsdown";

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
  outputOptions: {
    entryFileNames: "[name].js",
  },
  sourcemap: true,
  platform: "node",
  target: "node20",
  deps: {
    neverBundle: ["electron"],
  },
  clean: false,
  dts: false,
});
