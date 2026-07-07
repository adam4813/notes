import { createContext, useContext, type ReactNode } from "react";

export interface AppServices {
  /** Marks a note as modified so it is no longer a discardable provisional note. */
  markModified: (path: string) => void;
  createNote: (dir?: string) => void;
  createTable: (dir?: string) => void;
  createCanvas: (dir?: string) => void;
  createBoard: (dir?: string) => void;
}

const noop = () => {};

const AppServicesContext = createContext<AppServices>({
  markModified: noop,
  createNote: noop,
  createTable: noop,
  createCanvas: noop,
  createBoard: noop,
});

export function AppServicesProvider({
  value,
  children,
}: {
  value: AppServices;
  children: ReactNode;
}) {
  return <AppServicesContext.Provider value={value}>{children}</AppServicesContext.Provider>;
}

export function useAppServices(): AppServices {
  return useContext(AppServicesContext);
}
