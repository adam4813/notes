export interface MenuPosition {
  x: number;
  y: number;
}

/** Clamps a context-menu anchor so the menu remains inside the viewport. */
export function fitMenuToViewport(
  anchor: MenuPosition,
  menu: Pick<HTMLElement, "offsetWidth" | "offsetHeight">,
  padding = 8,
): MenuPosition {
  const maxX = Math.max(padding, window.innerWidth - menu.offsetWidth - padding);
  const maxY = Math.max(padding, window.innerHeight - menu.offsetHeight - padding);
  return {
    x: Math.min(Math.max(anchor.x, padding), maxX),
    y: Math.min(Math.max(anchor.y, padding), maxY),
  };
}
