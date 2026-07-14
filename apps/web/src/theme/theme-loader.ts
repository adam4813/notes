import type { ThemeMeta } from "@notes/shared";
import { api } from "../api/client";

const STYLE_ATTR = "data-theme-id";

/** Injects (or replaces) a `<style>` tag for a dynamically loaded theme. */
function injectThemeStyle(id: string, css: string): void {
  const existing = document.head.querySelector<HTMLStyleElement>(`style[${STYLE_ATTR}="${id}"]`);
  if (existing) {
    existing.textContent = css;
    return;
  }
  const el = document.createElement("style");
  el.setAttribute(STYLE_ATTR, id);
  el.textContent = css;
  document.head.appendChild(el);
}

/** Removes a previously injected theme style. */
export function removeThemeStyle(id: string): void {
  document.head
    .querySelectorAll<HTMLStyleElement>(`style[${STYLE_ATTR}="${id}"]`)
    .forEach((el) => el.remove());
}

/**
 * Fetches all installed themes from the server, injects their CSS, and
 * returns the list of theme metadata. Safe to call multiple times —
 * duplicate style tags are replaced in-place.
 */
export async function loadExternalThemes(): Promise<ThemeMeta[]> {
  let metas: ThemeMeta[] = [];
  try {
    const { themes } = await api.themes();
    metas = themes;
  } catch {
    return [];
  }

  await Promise.allSettled(
    metas.map(async (meta) => {
      try {
        const css = await api.themeStyle(meta.id);
        injectThemeStyle(meta.id, css);
      } catch {
        // Non-fatal: theme simply won't be available in the picker.
      }
    }),
  );

  return metas;
}
