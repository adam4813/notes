import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useWorkspace } from "../state/app-context";
import type { Pane, WorkspaceAction } from "../state/types";

interface SplitMenuItem {
  label: string;
  action: WorkspaceAction;
}

function buildSplitMenu(pane: Pane, paneCount: number): SplitMenuItem[] {
  const hasActiveTab = pane.tabs.some((tab) => tab.id === pane.activeTabId);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const close = (event: MouseEvent, tabId: string) => {
    event.stopPropagation();
    dispatch({ type: "closeTab", paneId: pane.id, tabId });
  };

  const items = buildSplitMenu(pane, state.panes.length);

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {pane.tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === pane.activeTabId ? "tab--active" : ""}`}
            onClick={() => dispatch({ type: "activateTab", paneId: pane.id, tabId: tab.id })}
          >
            <span className="tab-title">{tab.title}</span>
            <button className="tab-close" title="Close" onClick={(event) => close(event, tab.id)}>
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="split-wrap" ref={menuRef}>
        <button
          className="tab-split"
          title="Split options"
          aria-label="Split options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          disabled={items.length === 0}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ⫿
        </button>
        {menuOpen && items.length > 0 && (
          <div className="split-menu" role="menu">
            {items.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                className="split-menu-item"
                onClick={() => {
                  dispatch(item.action);
                  setMenuOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
