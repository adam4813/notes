import { createContext, useContext, useState, type ReactNode } from "react";

export interface DraggedTabInfo {
  tabId: string;
  paneId: string;
}

interface DragContextValue {
  draggedTab: DraggedTabInfo | null;
  setDraggedTab: (tab: DraggedTabInfo | null) => void;
}

const DragContext = createContext<DragContextValue>({
  draggedTab: null,
  setDraggedTab: () => {},
});

export function DragContextProvider({ children }: { children: ReactNode }) {
  const [draggedTab, setDraggedTab] = useState<DraggedTabInfo | null>(null);
  return (
    <DragContext.Provider value={{ draggedTab, setDraggedTab }}>{children}</DragContext.Provider>
  );
}

export function useDragContext(): DragContextValue {
  return useContext(DragContext);
}
