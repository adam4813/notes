import { createContext, useContext, type ReactNode } from "react";
import type { SettingsBodyProps } from "../components/settings-view";

export interface AppServices {
  /** Marks a note as modified so it is no longer a discardable provisional note. */
  markModified: (path: string) => void;
  createNote: (dir?: string) => void;
  createTable: (dir?: string) => void;
  createCanvas: (dir?: string) => void;
  createBoard: (dir?: string) => void;
  /** Publishes the active document to plugins (status bar, etc.). */
  setActiveDocument: (doc: { path: string; content: string; type: string } | null) => void;
  /** Everything the settings surface needs, so a settings tab can render. */
  settings: SettingsBodyProps;
}

const noop = () => {};

const defaultSettings: SettingsBodyProps = {
  plugins: [],
  onToggle: noop,
  theme: "system",
  onThemeChange: noop,
  accent: "",
  accentPresets: [],
  onAccentChange: noop,
  openInTab: false,
  onOpenInTabChange: noop,
  hotkeys: {
    commands: [],
    comboFor: () => undefined,
    format: (combo) => combo,
    isCustom: () => false,
    rebind: noop,
    reset: noop,
    conflicts: {},
  },
};

const AppServicesContext = createContext<AppServices>({
  markModified: noop,
  createNote: noop,
  createTable: noop,
  createCanvas: noop,
  createBoard: noop,
  setActiveDocument: noop,
  settings: defaultSettings,
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
