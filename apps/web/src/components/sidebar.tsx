import { useState } from "react";
import { Island, IslandBody, IslandHeader, Tab, TabStrip, useTabOverflow } from "@notes/ui";
import { Explorer } from "./explorer";
import { SearchPane } from "./search-pane";
import { TagPane } from "./tag-pane";

export type SidebarView = "explorer" | "search" | "tags";

const VIEWS: { id: SidebarView; label: string; icon: string }[] = [
  { id: "explorer", label: "Explorer", icon: "📁" },
  { id: "tags", label: "Tags", icon: "🏷️" },
];

const SIDEBAR_TAB_BUTTON_STYLE: React.CSSProperties = {
  minWidth: "unset",
  flex: 1,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontWeight: "bold",
  textTransform: "uppercase",
};

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
  const overflow = useTabOverflow(
    VIEWS.map((entry) => ({
      id: entry.id,
      path: entry.id,
      title: entry.label,
    })),
    view,
  );
  const [pendingTag, setPendingTag] = useState<string | undefined>(undefined);

  const pickTag = (tag: string) => {
    setPendingTag(tag);
    onViewChange("search");
  };

  return (
    <Island>
      <IslandHeader>
        <TabStrip
          listRef={overflow.tabListRef}
          registerTabRef={overflow.registerTabRef}
          hiddenTabIds={overflow.hiddenTabIds}
        >
          {VIEWS.map((entry) => (
            <Tab
              key={entry.id}
              id={entry.id}
              title={entry.label}
              active={entry.id === view}
              onActivate={() => onViewChange(entry.id as SidebarView)}
              style={SIDEBAR_TAB_BUTTON_STYLE}
            />
          ))}
        </TabStrip>
        <div className="sidebar-view-separator" aria-hidden />
        <button
          className="sidebar-view-btn--action"
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
