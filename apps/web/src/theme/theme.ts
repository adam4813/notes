import type { ThemeMode } from "../state/types";

const THEME_KEY = "notes.theme";
const ACCENT_KEY = "notes.accent";
const APP_FONT_KEY = "notes.font.app";
const EDITOR_FONT_KEY = "notes.font.editor";
const APP_FONT_FAMILY_KEY = "notes.fontFamily.app";
const EDITOR_FONT_FAMILY_KEY = "notes.fontFamily.editor";

export const DEFAULT_APP_FONT = 14;
export const DEFAULT_EDITOR_FONT = 16;
export const FONT_MIN = 12;
export const FONT_MAX = 22;

/** The system default font stack used when no explicit font family is chosen. */
export const DEFAULT_FONT_FAMILY = "";

/** Sentinel value meaning "use the same font as the app UI". */
export const USE_APP_FONT = "__use_app__";

export interface FontFamilyOption {
  id: string;
  label: string;
  value: string;
}

/** Static fallback presets used when the Local Font Access API is unavailable. */
export const FONT_FAMILY_PRESETS: FontFamilyOption[] = [
  { id: "system", label: "System default", value: "" },
  { id: "inter", label: "Inter", value: "Inter, sans-serif" },
  { id: "roboto", label: "Roboto", value: "Roboto, sans-serif" },
  { id: "open-sans", label: "Open Sans", value: "'Open Sans', sans-serif" },
  { id: "lato", label: "Lato", value: "Lato, sans-serif" },
  { id: "merriweather", label: "Merriweather", value: "Merriweather, serif" },
  { id: "georgia", label: "Georgia", value: "Georgia, serif" },
  { id: "fira-code", label: "Fira Code", value: "'Fira Code', monospace" },
  { id: "jetbrains-mono", label: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
];

/**
 * Queries system fonts via the Local Font Access API (`window.queryLocalFonts()`).
 * Returns a deduplicated, sorted list of font family options. Falls back to the
 * static preset list when the API is unavailable or the user denies permission.
 */
export async function querySystemFonts(): Promise<FontFamilyOption[]> {
  if (typeof window === "undefined" || !("queryLocalFonts" in window)) {
    return FONT_FAMILY_PRESETS;
  }
  try {
    const fonts: { family: string; fullName: string }[] = await (
      window as unknown as {
        queryLocalFonts: () => Promise<{ family: string; fullName: string }[]>;
      }
    ).queryLocalFonts();
    const families = new Set<string>();
    for (const font of fonts) {
      families.add(font.family);
    }
    const sorted = [...families].sort((a, b) => a.localeCompare(b));
    const options: FontFamilyOption[] = [
      { id: "system", label: "System default", value: "" },
      ...sorted.map((family) => ({
        id: family.toLowerCase().replace(/\s+/g, "-"),
        label: family,
        value: family,
      })),
    ];
    return options;
  } catch {
    return FONT_FAMILY_PRESETS;
  }
}

/**
 * Builds the final font family option list for the settings picker.
 * If the active theme declares a font preference, it is surfaced to the top
 * (right after "System default") with a label like "Theme — <FontName>".
 */
export function buildFontFamilyOptions(
  base: FontFamilyOption[],
  themeFont?: string,
): FontFamilyOption[] {
  if (!themeFont || base.length === 0) {
    return base;
  }
  // Check if the theme font is already in the list
  const existing = base.find(
    (o) => o.value === themeFont || o.label.localeCompare(themeFont, undefined, { sensitivity: "base" }) === 0,
  );
  // Build a theme entry that surfaces at position 1 (after System default)
  const themeValue = existing?.value ?? themeFont;
  const themeOption: FontFamilyOption = {
    id: `theme-${themeFont.toLowerCase().replace(/\s+/g, "-")}`,
    label: `Theme — ${themeFont}`,
    value: themeValue,
  };
  // Place it after "System default" and remove any duplicate by value
  const systemDefault = base.find((o) => o.id === "system") ?? base[0];
  const rest = base.filter((o) => o !== systemDefault && o.value !== themeValue);
  return [systemDefault, themeOption, ...rest];
}

/** Built-in accent presets; the first is the default (empty = token default). */
export const ACCENT_PRESETS: { id: string; label: string; value: string }[] = [
  { id: "violet", label: "Violet", value: "" },
  { id: "blue", label: "Blue", value: "#2563eb" },
  { id: "teal", label: "Teal", value: "#0d9488" },
  { id: "green", label: "Green", value: "#16a34a" },
  { id: "amber", label: "Amber", value: "#d97706" },
  { id: "rose", label: "Rose", value: "#e11d48" },
];

export function resolveTheme(mode: ThemeMode): string {
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

/** Loads persisted font family preferences. */
export function loadFontFamilies(): { app: string; editor: string } {
  return {
    app: window.localStorage.getItem(APP_FONT_FAMILY_KEY) ?? DEFAULT_FONT_FAMILY,
    editor: window.localStorage.getItem(EDITOR_FONT_FAMILY_KEY) ?? USE_APP_FONT,
  };
}

/** Applies font family CSS variables and persists preferences. */
export function applyFontFamilies(app: string, editor: string): void {
  const root = document.documentElement;
  if (app) {
    root.style.setProperty("--app-font-family", app);
  } else {
    root.style.removeProperty("--app-font-family");
  }
  // Resolve editor font: if USE_APP_FONT, inherit the app font
  const resolvedEditor = editor === USE_APP_FONT ? app : editor;
  if (resolvedEditor) {
    root.style.setProperty("--editor-font-family", resolvedEditor);
  } else {
    root.style.removeProperty("--editor-font-family");
  }
  window.localStorage.setItem(APP_FONT_FAMILY_KEY, app);
  window.localStorage.setItem(EDITOR_FONT_FAMILY_KEY, editor);
}
