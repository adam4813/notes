import React, { useEffect, useRef } from "react";

export function PopupMenu({
  open,
  onClose,
  children,
  menu,
  role = "menu",
  style,
  menuPosition,
}: {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  menu?: React.ReactNode;
  role?: string;
  style?: React.CSSProperties;
  menuPosition?: { x: number; y: number } | null;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (ev: PointerEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) {
        onClose();
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {children}
      {open && (
        <div
          style={{
            position: menuPosition ? "fixed" : undefined,
            left: menuPosition?.x,
            top: menuPosition?.y,
          }}
        >
          <div
            className="popup-menu"
            role={role}
            onMouseDown={(e) => e.stopPropagation()}
            style={style}
          >
            {menu}
          </div>
        </div>
      )}
    </div>
  );
}
