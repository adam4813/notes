import { useCallback, useEffect, useRef, useState } from "react";

export interface OverflowableTab {
  id: string;
}

/**
 * Calculates which tabs overflow the available horizontal space and which
 * should be hidden. Returns refs the consuming component attaches to the
 * list container and each individual tab element.
 */
export function useTabOverflow<T extends OverflowableTab>(
  tabs: T[],
  activeTabId: string | undefined,
) {
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefsMap = useRef<Record<string, HTMLDivElement | null>>({});
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeIdRef = useRef(activeTabId);
  activeIdRef.current = activeTabId;

  const [overflowTabs, setOverflowTabs] = useState<T[]>([]);
  const [hiddenTabIds, setHiddenTabIds] = useState<Set<string>>(new Set());

  const recalc = useCallback(() => {
    const list = tabListRef.current;
    if (!list) {
      setOverflowTabs([]);
      setHiddenTabIds(new Set());
      return;
    }

    const allTabs = tabsRef.current;
    const activeId = activeIdRef.current;
    const GAP = 2;
    const widthOf = (tab: T) => tabRefsMap.current[tab.id]?.offsetWidth ?? 140;

    let used = 0;
    const visible: T[] = [];

    for (const tab of allTabs) {
      const w = widthOf(tab);
      const next = used + w + (visible.length > 0 ? GAP : 0);
      if (next <= list.clientWidth) {
        visible.push(tab);
        used = next;
      }
    }

    // Ensure the active tab is always visible by bumping it in.
    const active = allTabs.find((t) => t.id === activeId);
    if (active && !visible.some((t) => t.id === active.id)) {
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

    const visibleIds = new Set(visible.map((t) => t.id));
    const overflow = allTabs.filter((t) => !visibleIds.has(t.id));
    setOverflowTabs(overflow);
    setHiddenTabIds(new Set(overflow.map((t) => t.id)));
  }, []);

  const scheduleRecalc = useCallback(() => {
    // Show all tabs first (so measureable widths are correct), then hide.
    setHiddenTabIds(new Set());
    window.requestAnimationFrame(recalc);
  }, [recalc]);

  useEffect(() => {
    const list = tabListRef.current;
    if (!list) return;
    const observer = new ResizeObserver(scheduleRecalc);
    observer.observe(list);
    const raf = window.requestAnimationFrame(scheduleRecalc);
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [tabs, activeTabId, scheduleRecalc]);

  const registerTabRef = useCallback((id: string, el: HTMLDivElement | null) => {
    tabRefsMap.current[id] = el;
  }, []);

  return { tabListRef, registerTabRef, overflowTabs, hiddenTabIds };
}
