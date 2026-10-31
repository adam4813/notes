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
 * A note view's contribution to the right-click menu.
 *
 * `items` are the view-specific actions (e.g. "Delete card", "Copy image").
 * `includeBasicActions` tells the host whether the generic clipboard actions
 * (Undo/Redo/Cut/Copy/Paste/Select All) also apply for this target — set it to
 * `true` for text surfaces so a selection keeps its clipboard actions, and omit
 * it (or set `false`) for non-text surfaces like canvas/board/table nodes.
 */
export interface ContextMenuContribution {
  items: ContextMenuEntry[];
  includeBasicActions?: boolean;
}

/**
 * Callback type that note-view components register with their parent NoteEditor
 * to supply content-specific context menu items.
 *
 * Receive the element that was right-clicked and return either:
 * - an array of items (equivalent to `{ items, includeBasicActions: false }`),
 * - a {@link ContextMenuContribution} to also opt into the basic clipboard
 *   actions, or
 * - `null` to decline, letting the host fall back to the basic actions.
 *
 * Unlike the previous contract, returning an empty `items` array no longer
 * suppresses the menu — the host always shows at least the basic actions so a
 * right-click is never a dead click.
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
export type CustomContextMenuBuilder = (
  target: Element | null,
) => ContextMenuEntry[] | ContextMenuContribution | null;

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
