import { useState, type ReactNode } from "react";

/* ─── PanelGroup ────────────────────────────────────────────────────────── */

/** Scrollable container that holds one or more PanelSection elements. */
export function PanelGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["panel-group", className].filter(Boolean).join(" ")}>{children}</div>;
}

/* ─── PanelSection ──────────────────────────────────────────────────────── */

interface PanelSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** Collapsible panel card — manages its own collapsed state. */
export function PanelSection({ title, children, defaultOpen = true }: PanelSectionProps) {
  const [collapsed, setCollapsed] = useState(!defaultOpen);

  return (
    <div
      className={["panel-section", collapsed && "panel-section--collapsed"]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        className="panel-header"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="panel-caret" aria-hidden>
          {collapsed ? "▸" : "▾"}
        </span>
        {title}
      </button>
      {!collapsed && <div className="panel-body">{children}</div>}
    </div>
  );
}

/* ─── PanelHeader / PanelBody ───────────────────────────────────────────── */

/** Standalone header bar (use when building a custom section layout). */
export function PanelHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["panel-header", className].filter(Boolean).join(" ")}>{children}</div>;
}

/** Content body (use alongside PanelHeader for a custom section layout). */
export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["panel-body", className].filter(Boolean).join(" ")}>{children}</div>;
}

/* ─── PanelEmpty ────────────────────────────────────────────────────────── */

/** Standard empty-state placeholder inside a panel or island body. */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return <div className="panel-empty">{children}</div>;
}
