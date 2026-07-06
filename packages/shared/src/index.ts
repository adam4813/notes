export const PACKAGE_NAME = "@notes/shared";

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
