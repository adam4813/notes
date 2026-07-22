import { type DragEvent, type MouseEvent, useMemo, useState } from "react";
import {
  ContextMenu,
  Tab,
  TabStrip,
  useContextMenu,
  useTabOverflow,
  type ContextMenuEntry,
} from "@notes/ui";
import { useAppServices } from "../state/app-services";
import { useWorkspace } from "../state/app-context";
import type { Pane, Tab as TabModel, WorkspaceAction } from "../state/types";
import { useDragContext } from "./drag-context";

interface CloseMenuItem {
  label: string;
  action: WorkspaceAction;
}

function buildCloseItems(pane: Pane, tab: TabModel, index: number): CloseMenuItem[] {
  if (pane.tabs.length === 0) return [];

  const items: CloseMenuItem[] = [
    {
      label: "Close all",
      action: { type: "closeAllTabs", paneId: pane.id },
    },
  ];

  if (pane.tabs.length > 1) {
    items.push({
      label: "Close others",
      action: { type: "closeOtherTabs", paneId: pane.id, tabId: tab.id },
    });
  }
  if (index < pane.tabs.length - 1) {
    items.push({
      label: "Close to the right",
      action: { type: "closeTabsToRight", paneId: pane.id, tabId: tab.id },
    });
  }
  if (index > 0) {
    items.push({
      label: "Close to the left",
      action: { type: "closeTabsToLeft", paneId: pane.id, tabId: tab.id },
    });
  }

  return items;
}

interface SplitMenuItem {
  label: string;
  action: WorkspaceAction;
}

function buildSplitItems(pane: Pane, paneCount: number): SplitMenuItem[] {
  if (pane.tabs.length === 0) return [];
  const hasActiveTab = pane.tabs.some((t) => t.id === pane.activeTabId);
  const items: SplitMenuItem[] = [];

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
  const { setDraggedTab } = useDragContext();

  const overflow = useTabOverflow(pane.tabs, pane.activeTabId);
  const ctxMenu = useContextMenu<TabModel>();

  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);

  const close = (event: MouseEvent, tabId: string) => {
    event.stopPropagation();
    dispatch({ type: "closeTab", paneId: pane.id, tabId });
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, tab: TabModel) => {
    e.dataTransfer.setData("application/notes-tab", JSON.stringify({ tabId: tab.id, paneId: pane.id }));
    e.dataTransfer.effectAllowed = "move";
    setDraggingTabId(tab.id);
    setDraggedTab({ tabId: tab.id, paneId: pane.id });
  };

  const handleDragEnd = () => {
    setDraggingTabId(null);
    setDraggedTab(null);
  };

  const handleTabDrop = (data: string, toTabId: string | null, side: "before" | "after") => {
    try {
      const { tabId: fromTabId, paneId: fromPaneId } = JSON.parse(data) as {
        tabId: string;
        paneId: string;
      };

      let toIndex: number;
      if (toTabId === null) {
        // Dropped on empty strip space — append after all tabs.
        toIndex = pane.tabs.length;
      } else {
        const idx = pane.tabs.findIndex((t) => t.id === toTabId);
        if (idx === -1) {
          toIndex = pane.tabs.length;
        } else {
          toIndex = side === "before" ? idx : idx + 1;
        }
      }

      dispatch({ type: "moveTab", fromPaneId, tabId: fromTabId, toPaneId: pane.id, toIndex });
    } catch {
      // ignore invalid drag data
    }
  };

  const contextMenuItems = useMemo((): ContextMenuEntry[] => {
    const tab = ctxMenu.menu?.data;
    if (!tab) return [];
    const index = pane.tabs.findIndex((t) => t.id === tab.id);

    const items: ContextMenuEntry[] = [];

    buildCloseItems(pane, tab, index).forEach((ci) => {
      items.push({
        label: ci.label,
        run: () => dispatch(ci.action),
      });
    });

    const splitItems = buildSplitItems(pane, state.panes.length);
    if (splitItems.length > 0) {
      items.push({ separator: true });
      splitItems.forEach((si) => items.push({ label: si.label, run: () => dispatch(si.action) }));
    }

    if (!tab.path.startsWith("notes://") && !tab.path.startsWith("standalone://")) {
      items.push(
        { separator: true },
        { label: "Rename…", run: () => void services.renamePath(tab.path) },
        { label: "Delete", run: () => void services.deletePath(tab.path), danger: true },
      );
    }

    return items;
  }, [ctxMenu.menu?.data]);

  return (
    <>
      <TabStrip
        listRef={overflow.tabListRef}
        registerTabRef={overflow.registerTabRef}
        hiddenTabIds={overflow.hiddenTabIds}
        overflowTabs={overflow.overflowTabs}
        onActivateOverflow={(id) => dispatch({ type: "activateTab", paneId: pane.id, tabId: id })}
        draggingTabId={draggingTabId}
        onTabDrop={handleTabDrop}
      >
        {pane.tabs.map((tab) => {
          const fileName =
            tab.path.startsWith("notes://") || tab.path.startsWith("standalone://")
              ? undefined
              : (tab.path.split("/").pop() ?? tab.path);
          const tooltip = fileName ? `${fileName}\n${tab.path}` : `${tab.title}\n${tab.path}`;
          return (
            <Tab
              key={tab.id}
              id={tab.id}
              title={tab.title}
              subtitle={fileName !== tab.title ? fileName : undefined}
              active={tab.id === pane.activeTabId}
              tooltip={tooltip}
              onActivate={() => dispatch({ type: "activateTab", paneId: pane.id, tabId: tab.id })}
              onClose={(e) => close(e, tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                ctxMenu.open({ x: e.clientX, y: e.clientY }, tab);
              }}
              draggable
              onDragStart={(e) => handleDragStart(e, tab)}
              onDragEnd={handleDragEnd}
            />
          );
        })}
      </TabStrip>

      {ctxMenu.menu && (
        <ContextMenu
          position={ctxMenu.menu.position}
          items={contextMenuItems}
          onClose={ctxMenu.close}
          menuRef={ctxMenu.menuRef}
        />
      )}
    </>
  );
}
