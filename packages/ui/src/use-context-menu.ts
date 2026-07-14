import { useCallback, useEffect, useRef, useState } from "react";

export interface MenuPosition {
  x: number;
  y: number;
}

/** Clamps a context-menu so it stays fully inside the viewport. */
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

export interface ContextMenuState<T> {
  position: MenuPosition;
  data: T;
}

/**
 * Manages open/close state for a context menu that carries arbitrary data
 * (e.g. which tab was right-clicked).
 *
 * @example
 * const ctxMenu = useContextMenu<Tab>();
 *
 * // In a tab's onContextMenu handler:
 * ctxMenu.open({ x: e.clientX, y: e.clientY }, tab);
 *
 * // In JSX:
 * {ctxMenu.menu && (
 *   <ContextMenu
 *     position={ctxMenu.menu.position}
 *     menuRef={ctxMenu.menuRef}
 *     onClose={ctxMenu.close}
 *     items={buildItems(ctxMenu.menu.data)}
 *   />
 * )}
 */
export function useContextMenu<T>() {
  const [menu, setMenu] = useState<ContextMenuState<T> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const open = useCallback((position: MenuPosition, data: T) => {
    setMenu({ position, data });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        close();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, close]);

  return { menu, menuRef, open, close };
}
