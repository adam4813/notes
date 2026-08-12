import { useLayoutEffect, useRef, useState } from "react";
import { fitMenuToViewport, MenuPosition } from "./use-context-menu";

export interface ContextMenuItemDef {
  label: string;
  run: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: never;
}

export interface ContextMenuSeparatorDef {
  separator: true;
  label?: never;
  run?: never;
}

export type ContextMenuEntry = ContextMenuItemDef | ContextMenuSeparatorDef;

/**
 * Callback type that note-view components register with their parent NoteEditor
 * to supply content-specific context menu items.
 *
 * Receive the element that was right-clicked; return an array of items to
 * replace the generic edit menu, or `null` to fall back to the default items.
 *
 * @example
 * ```ts
 * // In a note view component:
 * useEffect(() => {
 *   onRegisterContextMenu?.((target) => {
 *     const el = target?.closest("[data-my-item-id]");
 *     if (!el) return null;
 *     return [{ label: "Delete", run: () => deleteItem(el.dataset.myItemId!), danger: true }];
 *   });
 *   return () => onRegisterContextMenu?.(null);
 * }, [onRegisterContextMenu]);
 * ```
 */
export type CustomContextMenuBuilder = (target: Element | null) => ContextMenuEntry[] | null;

interface ContextMenuProps {
  position: MenuPosition;
  items: ContextMenuEntry[];
  onClose: () => void;
  menuRef?: React.RefObject<HTMLDivElement | null>;
}

export function ContextMenu({ position, items, onClose, menuRef }: ContextMenuProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = (menuRef ?? internalRef) as React.RefObject<HTMLDivElement>;
  const [pos, setPos] = useState(position);

  useLayoutEffect(() => {
    if (ref.current) {
      setPos(fitMenuToViewport(position, ref.current));
    }
  }, [position, ref]);

  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        "separator" in item ? (
          <div key={i} className="context-sep" role="separator" />
        ) : (
          <button
            key={i}
            role="menuitem"
            disabled={item.disabled}
            className={["context-item", item.danger && "context-item--danger"]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              item.run();
              onClose();
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
