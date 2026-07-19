import { createContext, useContext, type ReactNode } from "react";
import type { FileTypeHandler } from "@notes/plugin-host";
import type { SettingsBodyProps } from "../components/settings-view";

export interface AppServices {
  /** Marks a note as modified so it is no longer a discardable provisional note. */
  markModified: (path: string) => void;
  /** Requests an inline rename for the note at `path` and updates open tabs after commit. */
  renamePath: (path: string) => Promise<void>;
  /** Confirms and deletes the note at `path`, closing any open tabs. */
  deletePath: (path: string) => Promise<void>;
  createNote: (dir?: string) => void;
  createTable: (dir?: string) => void;
  createCanvas: (dir?: string) => void;
  createBoard: (dir?: string) => void;
  createMermaid: (dir?: string) => void;
  createCalendar: (dir?: string) => void;
  createGrid: (dir?: string) => void;
  /** Seeds a small sample Tome on first run. */
  seedSampleNotes: () => void;
  /** Map of note path → indexed note type (markdown/table/board/canvas). */
  noteTypes: Record<string, string>;
  /** Publishes the active document to plugins (status bar, etc.). */
  setActiveDocument: (doc: { path: string; content: string; type: string } | null) => void;
  /** Plugin-registered file-type handlers, keyed by file extension. */
  fileHandlers: FileTypeHandler[];
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
  appFontSize: 14,
  editorFontSize: 16,
  onAppFontSizeChange: noop,
  onEditorFontSizeChange: noop,
  openInTab: false,
  onOpenInTabChange: noop,
  mediaDirectory: "media",
  onMediaDirectoryChange: noop,
  renderedWidthDefault: "normal",
  onRenderedWidthDefaultChange: noop,
  externalThemes: [],
  onImportDefaultThemes: async () => {},
  tomePluginsPath: "",
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
  renamePath: async () => {},
  deletePath: async () => {},
  createNote: noop,
  createTable: noop,
  createCanvas: noop,
  createBoard: noop,
  createMermaid: noop,
  createCalendar: noop,
  createGrid: noop,
  seedSampleNotes: noop,
  noteTypes: {},
  setActiveDocument: noop,
  fileHandlers: [],
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
