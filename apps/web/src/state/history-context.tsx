import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/** A version the user has opened for read-only diff viewing. */
export interface HistorySelection {
  /** Note path whose version is being viewed. */
  path: string;
  /** Git commit oid of the selected version. */
  oid: string;
  /** Short, human-friendly label (e.g. a relative time) shown in the banner. */
  label: string;
}

interface HistoryViewValue {
  selection: HistorySelection | null;
  open: (selection: HistorySelection) => void;
  close: () => void;
}

const HistoryViewContext = createContext<HistoryViewValue | null>(null);

/**
 * Tracks which saved version (if any) is currently open for in-place diff
 * viewing. The right-panel history list sets the selection; the note editor
 * reads it and swaps its body for a read-only diff of the matching file.
 */
export function HistoryViewProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<HistorySelection | null>(null);

  const open = useCallback((next: HistorySelection) => setSelection(next), []);
  const close = useCallback(() => setSelection(null), []);

  const value = useMemo<HistoryViewValue>(
    () => ({ selection, open, close }),
    [selection, open, close],
  );

  return <HistoryViewContext.Provider value={value}>{children}</HistoryViewContext.Provider>;
}

/** Returns the current history diff selection and controls to open/close it. */
export function useHistoryView(): HistoryViewValue {
  const value = useContext(HistoryViewContext);
  if (!value) {
    throw new Error("useHistoryView must be used within a HistoryViewProvider");
  }
  return value;
}
