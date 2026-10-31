import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ContextMenu, type ContextMenuEntry } from "./context-menu";
import type { MenuPosition } from "./use-context-menu";

interface OpenContextMenu {
  position: MenuPosition;
  items: ContextMenuEntry[];
}

export interface ContextMenuController {
  /** Opens the app-wide context menu at a position with the given items. */
  open: (position: MenuPosition, items: ContextMenuEntry[]) => void;
  /** Closes the context menu if it is open. */
  close: () => void;
  /** Whether a context menu is currently open. */
  isOpen: boolean;
}

const ContextMenuControllerContext = createContext<ContextMenuController | null>(null);

/**
 * App-wide provider that owns a single right-click context menu instance.
 *
 * Any component can open the menu via {@link useContextMenuController}, so views
 * no longer each duplicate open/close/outside-click state. The menu is rendered
 * once at the provider boundary and positioned with `position: fixed`, keeping it
 * free of ancestor `overflow` clipping.
 */
export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<OpenContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const open = useCallback((position: MenuPosition, items: ContextMenuEntry[]) => {
    if (items.length === 0) {
      return;
    }
    setMenu({ position, items });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        close();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, close]);

  return (
    <ContextMenuControllerContext.Provider value={{ open, close, isOpen: menu !== null }}>
      {children}
      {menu && (
        <ContextMenu
          position={menu.position}
          items={menu.items}
          onClose={close}
          menuRef={menuRef}
        />
      )}
    </ContextMenuControllerContext.Provider>
  );
}

/**
 * Returns the app-wide context-menu controller.
 *
 * Throws when used outside a {@link ContextMenuProvider} so missing providers
 * fail fast instead of silently no-op'ing.
 */
export function useContextMenuController(): ContextMenuController {
  const controller = useContext(ContextMenuControllerContext);
  if (!controller) {
    throw new Error("useContextMenuController must be used within a ContextMenuProvider");
  }
  return controller;
}
