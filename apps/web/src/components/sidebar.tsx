import { Explorer } from "./explorer";

export function Sidebar({ onNewNote }: { onNewNote: () => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Explorer</span>
        <button className="btn-ghost" onClick={onNewNote}>
          ＋ New note
        </button>
      </div>
      <div className="sidebar-scroll">
        <Explorer />
      </div>
    </aside>
  );
}
