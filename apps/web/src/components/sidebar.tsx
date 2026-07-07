import { useEffect, useRef, useState } from "react";
import { Explorer } from "./explorer";

export interface NewAction {
  id: string;
  label: string;
  run: () => void;
}

export function Sidebar({ newActions }: { newActions: NewAction[] }) {
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

  return (
    <aside className="sidebar">
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
    </aside>
  );
}
