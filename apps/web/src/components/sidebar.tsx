import { useState } from "react";
import { Explorer } from "./explorer";
import { SearchPane } from "./search-pane";
import { TagPane } from "./tag-pane";

export type SidebarView = "explorer" | "search" | "tags";

const VIEWS: { id: SidebarView; label: string; icon: string }[] = [
  { id: "explorer", label: "Explorer", icon: "📁" },
  { id: "tags", label: "Tags", icon: "🏷️" },
];

export function Sidebar({
  view,
  onViewChange,
  onOpenPicker,
  searchQuery,
  renameRequestPath,
  onRenameRequestHandled,
}: {
  view: SidebarView;
  onViewChange: (view: SidebarView) => void;
  onOpenPicker: () => void;
  searchQuery: string;
  renameRequestPath: string | null;
  onRenameRequestHandled: () => void;
}) {
  const [pendingTag, setPendingTag] = useState<string | undefined>(undefined);

  const pickTag = (tag: string) => {
    setPendingTag(tag);
    onViewChange("search");
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
            onClick={() => onViewChange(entry.id)}
          >
            <span aria-hidden>{entry.icon}</span>
            <span className="sidebar-view-label">{entry.label}</span>
          </button>
        ))}
        <div className="sidebar-view-separator" aria-hidden />
        <button
          className="sidebar-view-btn sidebar-view-btn--action"
          title="Open or create note"
          aria-label="Open or create note"
          onClick={onOpenPicker}
        >
          <span aria-hidden>📂</span>
        </button>
      </div>

      {view === "explorer" && (
        <div className="sidebar-scroll">
          <Explorer
            renameRequestPath={renameRequestPath}
            onRenameRequestHandled={onRenameRequestHandled}
          />
        </div>
      )}

      {view === "search" && (
        <div className="sidebar-scroll">
          <SearchPane initialTag={pendingTag} initialQuery={searchQuery} />
        </div>
      )}

      {view === "tags" && (
        <div className="sidebar-scroll">
          <TagPane onPickTag={pickTag} />
        </div>
      )}
    </aside>
  );
}
