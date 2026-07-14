import { useState } from "react";
import { Island, IslandBody, IslandHeader } from "@notes/ui";
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
    <Island>
      <IslandHeader>
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
      </IslandHeader>

      <IslandBody>
        {view === "explorer" && (
          <Explorer
            renameRequestPath={renameRequestPath}
            onRenameRequestHandled={onRenameRequestHandled}
          />
        )}
        {view === "search" && <SearchPane initialTag={pendingTag} initialQuery={searchQuery} />}
        {view === "tags" && <TagPane onPickTag={pickTag} />}
      </IslandBody>
    </Island>
  );
}
