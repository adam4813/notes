export const PACKAGE_NAME = "@notes/shared";

/** Metadata for a user-installable theme package. */
export interface ThemeMeta {
  /** Unique identifier, used as the `data-theme` attribute value. */
  id: string;
  name: string;
  version: string;
  /** Which color modes the theme supports. Light/dark determines whether the
   *  theme should be offered when the OS prefers that scheme. */
  colorModes: ("light" | "dark")[];
  description?: string;
  author?: string;
  /** Default font family the theme prescribes for the app UI. */
  appFont?: string;
  /** Default font family the theme prescribes for the editor/note content. */
  editorFont?: string;
}

/** Product name (working title). */
export const APP_NAME = "Notes";

/**
 * User-facing container terms are centralized here so the naming theme
 * (Tower ▸ Tome) is re-skinnable without touching feature code.
 */
export const TERMS = {
  tower: "Tower",
  towerPlural: "Towers",
  tome: "Tome",
  tomePlural: "Tomes",
} as const;

export type TermKey = keyof typeof TERMS;

export function term(key: TermKey): string {
  return TERMS[key];
}

export * from "./schemas";
