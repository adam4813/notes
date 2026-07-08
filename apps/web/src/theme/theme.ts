import type { ThemeMode } from "../state/types";

const THEME_KEY = "notes.theme";
const ACCENT_KEY = "notes.accent";
const APP_FONT_KEY = "notes.font.app";
const EDITOR_FONT_KEY = "notes.font.editor";

export const DEFAULT_APP_FONT = 14;
export const DEFAULT_EDITOR_FONT = 16;
export const FONT_MIN = 12;
export const FONT_MAX = 22;

/** Built-in accent presets; the first is the default (empty = token default). */
export const ACCENT_PRESETS: { id: string; label: string; value: string }[] = [
  { id: "violet", label: "Violet", value: "" },
  { id: "blue", label: "Blue", value: "#2563eb" },
  { id: "teal", label: "Teal", value: "#0d9488" },
  { id: "green", label: "Green", value: "#16a34a" },
  { id: "amber", label: "Amber", value: "#d97706" },
  { id: "rose", label: "Rose", value: "#e11d48" },
];

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

/** Applies the theme to the document root and persists the preference. */
export function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = resolveTheme(mode);
  window.localStorage.setItem(THEME_KEY, mode);
}

export function loadAccent(): string {
  return window.localStorage.getItem(ACCENT_KEY) ?? "";
}

/**
 * Applies an accent color override to the `--accent` token and persists it.
 * An empty value clears the override and restores the theme default.
 */
export function applyAccent(color: string): void {
  const root = document.documentElement;
  if (color) {
    root.style.setProperty("--accent", color);
  } else {
    root.style.removeProperty("--accent");
  }
  window.localStorage.setItem(ACCENT_KEY, color);
}

function clampFont(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(value)));
}

export function loadFontSizes(): { app: number; editor: number } {
  return {
    app: clampFont(Number(window.localStorage.getItem(APP_FONT_KEY)), DEFAULT_APP_FONT),
    editor: clampFont(Number(window.localStorage.getItem(EDITOR_FONT_KEY)), DEFAULT_EDITOR_FONT),
  };
}

/** Applies app + editor font sizes to CSS variables and persists them. */
export function applyFontSizes(app: number, editor: number): void {
  const root = document.documentElement;
  root.style.setProperty("--app-font-size", `${clampFont(app, DEFAULT_APP_FONT)}px`);
  root.style.setProperty("--editor-font-size", `${clampFont(editor, DEFAULT_EDITOR_FONT)}px`);
  window.localStorage.setItem(APP_FONT_KEY, String(clampFont(app, DEFAULT_APP_FONT)));
  window.localStorage.setItem(EDITOR_FONT_KEY, String(clampFont(editor, DEFAULT_EDITOR_FONT)));
}
