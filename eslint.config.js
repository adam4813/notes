import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";
import pluginQuery from "@tanstack/eslint-plugin-query";

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
  reactHooks.configs.flat.recommended,
  ...pluginQuery.configs["flat/recommended"],
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
  {
    files: ["**/*.tsx", "**/*.ts"],
    rules: {
      "react-hooks/exhaustive-deps": ["warn"],
      "react-hooks/refs": ["off"],
      "react-hooks/purity": ["off"],
      "react-hooks/preserve-manual-memoization": ["off"],
      "react-hooks/set-state-in-effect": ["off"],
      "react-hooks/use-memo": ["off"],
      "react-hooks/rules-of-hooks": ["off"],
    },
  },
);
