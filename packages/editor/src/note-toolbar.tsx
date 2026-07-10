import { type ReactNode } from "react";

interface NoteToolbarProps {
  label: string;
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function NoteToolbar({ label, children, trailing, className }: NoteToolbarProps) {
  return (
    <div
      className={className ? `note-toolbar ${className}` : "note-toolbar"}
      role="toolbar"
      aria-label={label}
    >
      <div className="note-toolbar-main">{children}</div>
      {trailing && <div className="note-toolbar-trailing">{trailing}</div>}
    </div>
  );
}
