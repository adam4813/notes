import { useEffect, useRef, useState, type MouseEvent } from "react";
import { PopupMenu } from "@notes/ui";
import { fitMenuToViewport } from "../lib/context-menu";
import { useAppServices } from "../state/app-services";
import { useWorkspace } from "../state/app-context";
import type { Pane, Tab, WorkspaceAction } from "../state/types";

interface SplitMenuItem {
  label: string;
  action: WorkspaceAction;
}

function buildSplitMenu(pane: Pane, paneCount: number): SplitMenuItem[] {
  const hasActiveTab = pane.tabs.some((tab) => tab.id === pane.activeTabId);
  const items: SplitMenuItem[] = [];

  // Splitting an empty pane just produces two empty panes with no way out.
  if (pane.tabs.length === 0) {
    return items;
  }

  if (paneCount < 2) {
    items.push({
      label: pane.tabs.length <= 1 ? "Split & duplicate right" : "Split right",
      action: { type: "splitPane", paneId: pane.id, mode: "duplicate" },
    });
    if (pane.tabs.length > 1) {
      items.push({
        label: "Split & move right",
        action: { type: "splitPane", paneId: pane.id, mode: "move" },
      });
    }
  } else if (hasActiveTab) {
    items.push({
      label: "Move to opposite group",
      action: { type: "moveTabToOpposite", paneId: pane.id },
    });
  }

  return items;
}

export function TabBar({ pane }: { pane: Pane }) {
  const { state, dispatch } = useWorkspace();
  const services = useAppServices();
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const [tabMenu, setTabMenu] = useState<{ x: number; y: number; tab: Tab } | null>(null);
  const [overflowTabs, setOverflowTabs] = useState<Tab[]>([]);
  const [hiddenTabIds, setHiddenTabIds] = useState<Set<string>>(new Set());
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tabMenuRef = useRef<HTMLDivElement>(null);

  const recalcOverflowTabs = () => {
    const list = tabListRef.current;
    if (!list) {
      setOverflowTabs([]);
      setHiddenTabIds(new Set());
      return;
    }

    const GAP = 2;
    const widthOf = (tab: Tab) => tabRefs.current[tab.id]?.offsetWidth ?? 140;
    let used = 0;
    const visible: Tab[] = [];

    for (const tab of pane.tabs) {
      const width = widthOf(tab);
      const next = used + width + (visible.length > 0 ? GAP : 0);
      if (next <= list.clientWidth) {
        visible.push(tab);
        used = next;
      }
    }

    const active = pane.tabs.find((tab) => tab.id === pane.activeTabId);
    if (active && !visible.some((tab) => tab.id === active.id)) {
      let activeNext = used + widthOf(active) + (visible.length > 0 ? GAP : 0);
      while (visible.length > 0 && activeNext > list.clientWidth) {
        const removed = visible.pop()!;
        used -= widthOf(removed) + (visible.length > 0 ? GAP : 0);
        activeNext = used + widthOf(active) + (visible.length > 0 ? GAP : 0);
      }
      if (activeNext <= list.clientWidth || visible.length === 0) {
        visible.push(active);
      }
    }

    const visibleIds = new Set(visible.map((tab) => tab.id));
    const overflow = pane.tabs.filter((tab) => !visibleIds.has(tab.id));
    setOverflowTabs(overflow);
    setHiddenTabIds(new Set(overflow.map((tab) => tab.id)));
  };

  const scheduleOverflowRecalc = () => {
    setHiddenTabIds(new Set());
    window.requestAnimationFrame(recalcOverflowTabs);
  };

  useEffect(() => {
    if (!tabMenu) {
      return;
    }
    if (tabMenuRef.current) {
      const next = fitMenuToViewport(tabMenu, tabMenuRef.current);
      if (next.x !== tabMenu.x || next.y !== tabMenu.y) {
        setTabMenu((prev) => (prev ? { ...prev, ...next } : prev));
      }
    }
    const close = () => setTabMenu(null);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setTabMenu(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [tabMenu]);

  useEffect(() => {
    const list = tabListRef.current;
    if (!list) {
      return;
    }
    const observer = new ResizeObserver(() => scheduleOverflowRecalc());
    observer.observe(list);
    const raf = window.requestAnimationFrame(() => scheduleOverflowRecalc());
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [pane.tabs, pane.activeTabId]);

  const close = (event: MouseEvent, tabId: string) => {
    event.stopPropagation();
    dispatch({ type: "closeTab", paneId: pane.id, tabId });
  };

  const openTabMenu = (event: MouseEvent, tab: Tab) => {
    event.preventDefault();
    event.stopPropagation();
    setTabMenu({ x: event.clientX, y: event.clientY, tab });
  };

  const splitMenuItems = buildSplitMenu(pane, state.panes.length);

  const tabMenuItems = (tab: Tab): { label: string; run: () => void; danger?: boolean }[] => {
    const index = pane.tabs.findIndex((candidate) => candidate.id === tab.id);
    const items: { label: string; run: () => void; danger?: boolean }[] = [
      { label: "Close", run: () => dispatch({ type: "closeTab", paneId: pane.id, tabId: tab.id }) },
    ];
    if (pane.tabs.length > 1) {
      items.push({
        label: "Close others",
        run: () => dispatch({ type: "closeOtherTabs", paneId: pane.id, tabId: tab.id }),
      });
    }
    if (index < pane.tabs.length - 1) {
      items.push({
        label: "Close to the right",
        run: () => dispatch({ type: "closeTabsToRight", paneId: pane.id, tabId: tab.id }),
      });
    }
    if (index > 0) {
      items.push({
        label: "Close to the left",
        run: () => dispatch({ type: "closeTabsToLeft", paneId: pane.id, tabId: tab.id }),
      });
    }
    items.push({
      label: "Close all",
      run: () => dispatch({ type: "closeAllTabs", paneId: pane.id }),
    });
    splitMenuItems.forEach((item) =>
      items.push({ label: item.label, run: () => dispatch(item.action) }),
    );
    if (!tab.path.startsWith("notes://")) {
      items.push(
        { label: "Rename…", run: () => void services.renamePath(tab.path) },
        { label: "Delete", run: () => void services.deletePath(tab.path), danger: true },
      );
    }
    return items;
  };

  return (
    <div className="tab-bar">
      <div className="tab-list" ref={tabListRef}>
        {pane.tabs.map((tab) => {
          if (hiddenTabIds.has(tab.id)) {
            return null;
          }
          const fileName = tab.path.startsWith("notes://")
            ? undefined
            : (tab.path.split("/").pop() ?? tab.path);
          const hoverTitle = fileName ? `${fileName}\n${tab.path}` : `${tab.title}\n${tab.path}`;
          return (
            <div
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              key={tab.id}
              className={`tab ${tab.id === pane.activeTabId ? "tab--active" : ""}`}
              title={hoverTitle}
              onClick={() => dispatch({ type: "activateTab", paneId: pane.id, tabId: tab.id })}
              onContextMenu={(event) => openTabMenu(event, tab)}
            >
              <span className="tab-title">{tab.title}</span>
              {fileName && fileName !== tab.title && <span className="tab-file">{fileName}</span>}
              <button
                className="tab-close"
                aria-label="Close tab"
                onClick={(event) => close(event, tab.id)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {overflowTabs.length > 0 && (
        <PopupMenu
          open={overflowMenuOpen}
          onClose={() => setOverflowMenuOpen((open) => !open)}
          menu={
            <>
              {overflowTabs.map((tab) => (
                <button
                  key={tab.id}
                  role="menuitem"
                  title={tab.path}
                  onClick={() => {
                    dispatch({ type: "activateTab", paneId: pane.id, tabId: tab.id });
                    setOverflowMenuOpen(false);
                  }}
                >
                  {tab.title}
                </button>
              ))}
            </>
          }
        >
          <button
            className="tab-button"
            title="Overflow tabs"
            aria-label="Overflow tabs"
            aria-haspopup="menu"
            aria-expanded={overflowMenuOpen}
            onClick={() => setOverflowMenuOpen((open) => !open)}
          >
            ▼
          </button>
        </PopupMenu>
      )}

      {tabMenu && (
        <div
          ref={tabMenuRef}
          className="context-menu"
          role="menu"
          style={{ left: tabMenu.x, top: tabMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {tabMenuItems(tabMenu.tab).map((item) => (
            <button
              key={item.label}
              role="menuitem"
              className={`context-item ${item.danger ? "context-item--danger" : ""}`}
              onClick={() => {
                item.run();
                setTabMenu(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
