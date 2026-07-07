import type { ThemeMode } from "../state/types";

const THEME_KEY = "notes.theme";
const ACCENT_KEY = "notes.accent";

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
