import {
  createContext,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { PopupMenu } from "./popup-menu";

/* ─── Context used by Tab to register itself with TabStrip ─────────────── */

interface TabStripCtx {
  registerTabRef: (id: string, el: HTMLDivElement | null) => void;
  hiddenTabIds: Set<string>;
  dragOverTabId: string | null;
  dragOverSide: "before" | "after" | null;
  draggingTabId: string | null;
}

const TabStripContext = createContext<TabStripCtx>({
  registerTabRef: () => {},
  hiddenTabIds: new Set(),
  dragOverTabId: null,
  dragOverSide: null,
  draggingTabId: null,
});

/* ─── TabStrip ──────────────────────────────────────────────────────────── */

interface OverflowItem {
  id: string;
  title: string;
}

interface TabStripProps {
  children: ReactNode;
  /** Ref returned by useTabOverflow — attach to the list container */
  listRef: React.RefObject<HTMLDivElement | null>;
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
  /** ID of the tab currently being dragged (applies dimmed styling) */
  draggingTabId?: string | null;
  /**
   * Called when a dragged tab is dropped onto the strip.
   * @param data  Raw value from dataTransfer (set during dragstart)
   * @param toTabId  The tab id under the drop cursor, or null if empty space
   * @param side  Whether the drop is before or after `toTabId`
   */
  onTabDrop?: (data: string, toTabId: string | null, side: "before" | "after") => void;
}

export function TabStrip({
  children,
  listRef,
  registerTabRef,
  hiddenTabIds,
  overflowTabs = [],
  onActivateOverflow,
  trailing,
  draggingTabId = null,
  onTabDrop,
}: TabStripProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [dragOverSide, setDragOverSide] = useState<"before" | "after" | null>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const tabEl = (e.target as Element).closest("[data-tab-id]") as HTMLElement | null;
    // Ignore the tab currently being dragged — no point showing a drop indicator on itself.
    if (tabEl?.dataset.tabId && tabEl.dataset.tabId !== draggingTabId) {
      const rect = tabEl.getBoundingClientRect();
      const side: "before" | "after" = e.clientX < rect.left + rect.width / 2 ? "before" : "after";
      setDragOverTabId(tabEl.dataset.tabId);
      setDragOverSide(side);
    } else {
      setDragOverTabId(null);
      setDragOverSide(null);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/notes-tab");
    if (data) {
      onTabDrop?.(data, dragOverTabId, dragOverSide ?? "after");
    }
    setDragOverTabId(null);
    setDragOverSide(null);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverTabId(null);
      setDragOverSide(null);
    }
  };

  return (
    <TabStripContext.Provider
      value={{ registerTabRef, hiddenTabIds, dragOverTabId, dragOverSide, draggingTabId }}
    >
      <div
        className="tab-strip"
        ref={listRef}
        role="tablist"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={handleDragLeave}
      >
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
  /** Whether this tab can be dragged */
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
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
  draggable,
  onDragStart,
  onDragEnd,
}: TabProps) {
  const { registerTabRef, hiddenTabIds, dragOverTabId, dragOverSide, draggingTabId } =
    useContext(TabStripContext);
  const hidden = hiddenTabIds.has(id);
  const isDropBefore = dragOverTabId === id && dragOverSide === "before";
  const isDropAfter = dragOverTabId === id && dragOverSide === "after";
  const isBeingDragged = draggingTabId === id;

  return (
    <div
      ref={(el) => registerTabRef(id, el)}
      className={[
        "tab",
        active && "tab--active",
        hidden && "tab--hidden",
        isDropBefore && "tab--drop-before",
        isDropAfter && "tab--drop-after",
        isBeingDragged && "tab--dragging",
      ]
        .filter(Boolean)
        .join(" ")}
      data-tab-id={id}
      title={tooltip}
      draggable={draggable}
      onClick={onActivate}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={style}
      role="tab"
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
