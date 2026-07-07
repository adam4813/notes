import type { PluginInfo } from "@notes/plugin-host";
import { createContext, useContext, type ReactNode } from "react";

/** Plugin surface a settings view needs (subset of the usePlugins API). */
export interface PluginsView {
  list: PluginInfo[];
  toggle: (id: string, enabled: boolean) => void;
}

export interface AppServices {
  /** Marks a note as modified so it is no longer a discardable provisional note. */
  markModified: (path: string) => void;
  createNote: (dir?: string) => void;
  createTable: (dir?: string) => void;
  createCanvas: (dir?: string) => void;
  createBoard: (dir?: string) => void;
  /** Publishes the active document to plugins (status bar, etc.). */
  setActiveDocument: (doc: { path: string; content: string; type: string } | null) => void;
  /** Plugin list + toggle, so a settings tab can render without prop drilling. */
  plugins: PluginsView;
  /** Whether settings should open in a tab (true) or a modal dialog (false). */
  openSettingsInTab: boolean;
  /** Switches the settings surface between tab and dialog, converting live. */
  setOpenSettingsInTab: (openInTab: boolean) => void;
}

const noop = () => {};

const AppServicesContext = createContext<AppServices>({
  markModified: noop,
  createNote: noop,
  createTable: noop,
  createCanvas: noop,
  createBoard: noop,
  setActiveDocument: noop,
  plugins: { list: [], toggle: noop },
  openSettingsInTab: false,
  setOpenSettingsInTab: noop,
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
