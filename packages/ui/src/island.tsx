import type { ReactNode } from "react";

interface IslandProps {
  children: ReactNode;
  active?: boolean;
  grow?: boolean;
  className?: string;
  /** Called when the island receives a mousedown — use to focus this island */
  onFocus?: () => void;
}

export function Island({
  children,
  active = false,
  grow = false,
  className,
  onFocus,
}: IslandProps) {
  const cls = ["island", active && "island--active", grow && "island--grow", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} onMouseDown={onFocus}>
      {children}
    </div>
  );
}

interface SlotProps {
  children: ReactNode;
  className?: string;
}

export function IslandHeader({ children, className }: SlotProps) {
  return <div className={["island-header", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function IslandBody({ children, className }: SlotProps) {
  return <div className={["island-body", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function IslandFooter({ children, className }: SlotProps) {
  return <div className={["island-footer", className].filter(Boolean).join(" ")}>{children}</div>;
}
