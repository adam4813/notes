import { createContext, type MouseEvent, type ReactNode, useContext, useState } from "react";
import { PopupMenu } from "./popup-menu";

/* ─── Context used by Tab to register itself with TabStrip ─────────────── */

interface TabStripCtx {
  registerTabRef: (id: string, el: HTMLDivElement | null) => void;
  hiddenTabIds: Set<string>;
}

const TabStripContext = createContext<TabStripCtx>({
  registerTabRef: () => {},
  hiddenTabIds: new Set(),
});

/* ─── TabStrip ──────────────────────────────────────────────────────────── */

interface OverflowItem {
  id: string;
  title: string;
}

interface TabStripProps {
  children: ReactNode;
  /** Ref returned by useTabOverflow — attach to the list container */
  listRef: React.RefObject<HTMLDivElement>;
  /** Callback returned by useTabOverflow — register each tab's DOM node */
  registerTabRef: (id: string, el: HTMLDivElement | null) => void;
  /** Set returned by useTabOverflow — which tab ids should be hidden */
  hiddenTabIds: Set<string>;
  /** Tabs that overflow the available width, shown in the overflow popup */
  overflowTabs?: OverflowItem[];
  /** Called when user picks a tab from the overflow popup */
  onActivateOverflow?: (id: string) => void;
  /** Any extra buttons to render after the overflow trigger */
  trailing?: ReactNode;
}

export function TabStrip({
  children,
  listRef,
  registerTabRef,
  hiddenTabIds,
  overflowTabs = [],
  onActivateOverflow,
  trailing,
}: TabStripProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);

  return (
    <TabStripContext.Provider value={{ registerTabRef, hiddenTabIds }}>
      <div className="tab-strip" ref={listRef}>
        {children}
      </div>

      {overflowTabs.length > 0 && (
        <PopupMenu
          open={overflowOpen}
          onClose={() => setOverflowOpen(false)}
          menu={
            <>
              {overflowTabs.map((tab) => (
                <button
                  key={tab.id}
                  role="menuitem"
                  onClick={() => {
                    onActivateOverflow?.(tab.id);
                    setOverflowOpen(false);
                  }}
                >
                  {tab.title}
                </button>
              ))}
            </>
          }
        >
          <button
            className="tab-overflow"
            aria-label="Overflow tabs"
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen((o) => !o)}
          >
            ▼
          </button>
        </PopupMenu>
      )}

      {trailing}
    </TabStripContext.Provider>
  );
}

/* ─── Tab ───────────────────────────────────────────────────────────────── */

interface TabProps {
  id: string;
  /** Primary label */
  title: string;
  /** Optional secondary label (e.g. filename when different from title) */
  subtitle?: string;
  active?: boolean;
  /** Hover tooltip */
  tooltip?: string;
  onActivate?: () => void;
  onClose?: (event: MouseEvent) => void;
  onContextMenu?: (event: MouseEvent) => void;
  style?: React.CSSProperties;
}

export function Tab({
  id,
  title,
  subtitle,
  active = false,
  tooltip,
  onActivate,
  onClose,
  onContextMenu,
  style,
}: TabProps) {
  const { registerTabRef, hiddenTabIds } = useContext(TabStripContext);
  const hidden = hiddenTabIds.has(id);

  return (
    <div
      ref={(el) => registerTabRef(id, el)}
      className={["tab", active && "tab--active", hidden && "tab--hidden"]
        .filter(Boolean)
        .join(" ")}
      title={tooltip}
      onClick={onActivate}
      onContextMenu={onContextMenu}
      style={style}
    >
      <span className="tab__title">{title}</span>
      {subtitle && <span className="tab__subtitle">{subtitle}</span>}
      {onClose && (
        <button
          className="tab__close"
          aria-label="Close tab"
          onClick={(e) => {
            e.stopPropagation();
            onClose(e);
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

/* ─── ContextMenu ───────────────────────────────────────────────────────── */
