import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/.vite/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "**/dist/**",
      "**/dist-*/**",
      "**/*-staging/**",
      "**/build/**",
      "plugins-marketplace/**",
      "dev-tome/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: { import: importPlugin },
    rules: {
      // Named exports only — enforces the project convention.
      "import/no-default-export": "error",
      "no-regex-spaces": "off",
    },
  },
  {
    // Config files and framework entrypoints require default exports.
    files: [
      "**/*.config.{ts,js,mjs}",
      "**/vite.config.ts",
      "**/playwright.config.ts",
      "**/vitest.config.ts",
      "**/eslint.config.js",
    ],
    rules: { "import/no-default-export": "off" },
  },
);
