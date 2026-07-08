import { useEffect, useRef, useState } from "react";
import { Explorer } from "./explorer";
import { SearchPane } from "./search-pane";
import { TagPane } from "./tag-pane";

export interface NewAction {
  id: string;
  label: string;
  run: () => void;
}

type SidebarView = "explorer" | "search" | "tags";

const VIEWS: { id: SidebarView; label: string; icon: string }[] = [
  { id: "explorer", label: "Explorer", icon: "📁" },
  { id: "search", label: "Search", icon: "🔍" },
  { id: "tags", label: "Tags", icon: "🏷️" },
];

export function Sidebar({ newActions }: { newActions: NewAction[] }) {
  const [view, setView] = useState<SidebarView>("explorer");
  const [pendingTag, setPendingTag] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const primary = newActions[0];

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const pickTag = (tag: string) => {
    setPendingTag(tag);
    setView("search");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-views" role="tablist" aria-label="Sidebar views">
        {VIEWS.map((entry) => (
          <button
            key={entry.id}
            role="tab"
            aria-selected={view === entry.id}
            title={entry.label}
            data-testid={`sidebar-view-${entry.id}`}
            className={`sidebar-view-btn ${view === entry.id ? "sidebar-view-btn--active" : ""}`}
            onClick={() => setView(entry.id)}
          >
            <span aria-hidden>{entry.icon}</span>
            <span className="sidebar-view-label">{entry.label}</span>
          </button>
        ))}
      </div>

      {view === "explorer" && (
        <>
          <div className="sidebar-header">
            <span className="sidebar-title">Explorer</span>
            <div className="new-button" ref={ref}>
              <button className="btn-ghost new-button-main" onClick={() => primary?.run()}>
                ＋ New note
              </button>
              <button
                className="btn-ghost new-button-caret"
                aria-label="Choose a note type"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
              >
                ▾
              </button>
              {open && (
                <div className="new-menu" role="menu">
                  {newActions.map((action) => (
                    <button
                      key={action.id}
                      role="menuitem"
                      className="new-menu-item"
                      onClick={() => {
                        action.run();
                        setOpen(false);
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="sidebar-scroll">
            <Explorer />
          </div>
        </>
      )}

      {view === "search" && (
        <>
          <div className="sidebar-header">
            <span className="sidebar-title">Search</span>
          </div>
          <div className="sidebar-scroll">
            <SearchPane initialTag={pendingTag} />
          </div>
        </>
      )}

      {view === "tags" && (
        <>
          <div className="sidebar-header">
            <span className="sidebar-title">Tags</span>
          </div>
          <div className="sidebar-scroll">
            <TagPane onPickTag={pickTag} />
          </div>
        </>
      )}
    </aside>
  );
}
