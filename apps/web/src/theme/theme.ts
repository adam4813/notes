import type { ThemeMode } from "../state/types";

const THEME_KEY = "notes.theme";

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
