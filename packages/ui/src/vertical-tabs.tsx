import type { ReactNode } from "react";

/* ─── VerticalTabs ──────────────────────────────────────────────────────────
   Generic, reusable vertical tab rail. Presentational only: the caller owns
   the active id and renders the active panel beside it. Scrolls independently
   on short viewports.
   ──────────────────────────────────────────────────────────────────────── */

export interface VerticalTabItem {
  id: string;
  label: string;
  /** Optional leading glyph/icon shown before the label. */
  icon?: ReactNode;
}

interface VerticalTabsProps {
  items: VerticalTabItem[];
  /** Id of the currently selected tab. */
  activeId: string;
  onSelect: (id: string) => void;
  /** Accessible label for the tablist. */
  ariaLabel?: string;
  className?: string;
}

/** Vertical list of tabs; apply `role="tabpanel"` to the matching content. */
export function VerticalTabs({
  items,
  activeId,
  onSelect,
  ariaLabel = "Sections",
  className,
}: VerticalTabsProps) {
  return (
    <div
      className={["vtabs", className].filter(Boolean).join(" ")}
      role="tablist"
      aria-orientation="vertical"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            role="tab"
            id={`vtab-${item.id}`}
            aria-selected={active}
            aria-controls={`vtabpanel-${item.id}`}
            tabIndex={active ? 0 : -1}
            className={["vtab", active && "vtab--active"].filter(Boolean).join(" ")}
            onClick={() => onSelect(item.id)}
          >
            {item.icon && (
              <span className="vtab__icon" aria-hidden>
                {item.icon}
              </span>
            )}
            <span className="vtab__label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
