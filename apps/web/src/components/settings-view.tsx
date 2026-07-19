import type { PluginInfo } from "@notes/plugin-host";
import type { ThemeMeta } from "@notes/shared";
import type { ThemeMode } from "../state/types";
import { HotkeyRow } from "./hotkey-row";

/** Reserved tab path that renders the settings surface instead of a note. */
export const SETTINGS_TAB_PATH = "notes://settings";

/** Data + callbacks a settings command entry needs. */
export interface SettingsCommand {
  id: string;
  title: string;
  category?: string;
}

export interface HotkeySettings {
  commands: SettingsCommand[];
  /** Raw (authored) combo for a command, e.g. "Mod+P". */
  comboFor: (commandId: string) => string | undefined;
  /** Formats a raw combo for display, e.g. "Ctrl+P". */
  format: (combo: string) => string;
  isCustom: (commandId: string) => boolean;
  rebind: (commandId: string, combo: string) => void;
  reset: (commandId: string) => void;
  conflicts: Record<string, string[]>;
}

export interface AccentPreset {
  id: string;
  label: string;
  value: string;
}

export interface SettingsBodyProps {
  plugins: PluginInfo[];
  onToggle: (id: string, enabled: boolean) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  accent: string;
  accentPresets: AccentPreset[];
  onAccentChange: (accent: string) => void;
  appFontSize: number;
  editorFontSize: number;
  onAppFontSizeChange: (size: number) => void;
  onEditorFontSizeChange: (size: number) => void;
  openInTab: boolean;
  onOpenInTabChange: (openInTab: boolean) => void;
  mediaDirectory: string;
  onMediaDirectoryChange: (value: string) => void;
  renderedWidthDefault: "normal" | "wide";
  onRenderedWidthDefaultChange: (value: "normal" | "wide") => void;
  hotkeys: HotkeySettings;
  /** Externally installed themes loaded from the Tome's `.notes/themes/`. */
  externalThemes: ThemeMeta[];
  onImportDefaultThemes: () => Promise<void>;
  /** Filesystem path to the Tome's `.notes/plugins/` folder. */
  tomePluginsPath: string;
}

const BUILT_IN_THEME_OPTIONS: { value: string; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "solarized", label: "Solarized" },
  { value: "contrast", label: "High contrast" },
];

function uiThemeValue(theme: ThemeMode): string {
  if (theme === "light" || theme === "dark" || theme === "system") {
    return "default";
  }
  return theme;
}

function resolveThemeSelection(next: string, current: ThemeMode): ThemeMode {
  if (next !== "default") {
    return next;
  }
  if (current === "light" || current === "dark" || current === "system") {
    return current;
  }
  return "system";
}

/** Shared settings content, reused by both the modal and the tab view. */
export function SettingsBody(props: SettingsBodyProps) {
  const {
    plugins,
    onToggle,
    theme,
    onThemeChange,
    accent,
    accentPresets,
    onAccentChange,
    appFontSize,
    editorFontSize,
    onAppFontSizeChange,
    onEditorFontSizeChange,
    openInTab,
    onOpenInTabChange,
    mediaDirectory,
    onMediaDirectoryChange,
    renderedWidthDefault,
    onRenderedWidthDefaultChange,
    hotkeys,
    externalThemes,
    onImportDefaultThemes,
    tomePluginsPath,
  } = props;

  const allThemeOptions = [
    ...BUILT_IN_THEME_OPTIONS,
    ...externalThemes.map((t) => ({ value: t.id, label: t.name })),
  ];
  const selectedTheme = uiThemeValue(theme);

  const commandTitle = (id: string) => {
    const command = hotkeys.commands.find((entry) => entry.id === id);
    return command ? command.title : id;
  };

  return (
    <>
      <section className="settings-section">
        <h3>General</h3>
        <label className="switch">
          <input
            type="checkbox"
            data-testid="settings-open-in-tab"
            checked={openInTab}
            onChange={(event) => onOpenInTabChange(event.target.checked)}
          />
          <span>Open settings in a tab instead of a dialog</span>
        </label>
      </section>

      <section className="settings-section">
        <h3>Files</h3>
        <p className="settings-hint">
          Imported files (paste/drag-drop) are saved into this folder under your Tome.
        </p>
        <div className="settings-field">
          <span className="settings-label">Directory</span>
          <input
            type="text"
            className="settings-text-input"
            aria-label="Media directory"
            data-testid="settings-media-directory"
            placeholder="media"
            value={mediaDirectory}
            onChange={(event) => onMediaDirectoryChange(event.target.value)}
          />
        </div>
      </section>

      <section className="settings-section">
        <h3>Appearance</h3>
        <div className="settings-field">
          <span className="settings-label">Theme</span>
          <div className="segmented" role="radiogroup" aria-label="Theme">
            {allThemeOptions.map((option) => (
              <button
                key={option.value}
                role="radio"
                aria-checked={selectedTheme === option.value}
                className={`segmented-btn ${selectedTheme === option.value ? "segmented-btn--active" : ""}`}
                onClick={() => onThemeChange(resolveThemeSelection(option.value, theme))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-field">
          <span className="settings-label">Add-ons</span>
          <button
            className="settings-import-btn"
            onClick={() => void onImportDefaultThemes()}
            title="Copy bundled theme add-ons into your Tome's .notes/themes folder"
          >
            Import default themes
          </button>
        </div>
        <div className="settings-field">
          <span className="settings-label">Accent</span>
          <div className="accent-swatches" role="radiogroup" aria-label="Accent color">
            {accentPresets.map((preset) => (
              <button
                key={preset.id}
                role="radio"
                aria-checked={accent === preset.value}
                aria-label={preset.label}
                title={preset.label}
                data-testid={`accent-${preset.id}`}
                className={`accent-swatch ${accent === preset.value ? "accent-swatch--active" : ""}`}
                style={{ background: preset.value || "var(--accent)" }}
                onClick={() => onAccentChange(preset.value)}
              />
            ))}
            <input
              type="color"
              className="accent-custom"
              aria-label="Custom accent color"
              data-testid="accent-custom"
              value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#7c3aed"}
              onChange={(event) => onAccentChange(event.target.value)}
            />
          </div>
        </div>
        <div className="settings-field">
          <span className="settings-label">App font</span>
          <input
            type="range"
            min={12}
            max={22}
            step={1}
            aria-label="App font size"
            data-testid="app-font-size"
            value={appFontSize}
            onChange={(event) => onAppFontSizeChange(Number(event.target.value))}
          />
          <span className="settings-value">{appFontSize}px</span>
        </div>
        <div className="settings-field">
          <span className="settings-label">Editor font</span>
          <input
            type="range"
            min={12}
            max={22}
            step={1}
            aria-label="Editor font size"
            data-testid="editor-font-size"
            value={editorFontSize}
            onChange={(event) => onEditorFontSizeChange(Number(event.target.value))}
          />
          <span className="settings-value">{editorFontSize}px</span>
        </div>
        <div className="settings-field">
          <span className="settings-label">Rendered note width</span>
          <div className="segmented" role="radiogroup" aria-label="Default rendered note width">
            <button
              role="radio"
              aria-checked={renderedWidthDefault === "normal"}
              className={`segmented-btn ${renderedWidthDefault === "normal" ? "segmented-btn--active" : ""}`}
              onClick={() => onRenderedWidthDefaultChange("normal")}
            >
              Normal
            </button>
            <button
              role="radio"
              aria-checked={renderedWidthDefault === "wide"}
              className={`segmented-btn ${renderedWidthDefault === "wide" ? "segmented-btn--active" : ""}`}
              onClick={() => onRenderedWidthDefaultChange("wide")}
            >
              Wide
            </button>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h3>Hotkeys</h3>
        <p className="settings-hint">
          Click a shortcut, then press a key combo to rebind. Conflicts are highlighted.
        </p>
        <ul className="hotkey-list">
          {hotkeys.commands.map((command) => (
            <HotkeyRow
              key={command.id}
              command={command}
              combo={hotkeys.comboFor(command.id)}
              format={hotkeys.format}
              custom={hotkeys.isCustom(command.id)}
              conflictWith={findConflictLabel(hotkeys, command.id, commandTitle)}
              onRebind={(combo) => hotkeys.rebind(command.id, combo)}
              onReset={() => hotkeys.reset(command.id)}
            />
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <h3>Plugins</h3>
        <p className="settings-hint">
          Local, trusted plugins load in-process. See docs/plugins.md to write your own.
        </p>
        {tomePluginsPath && (
          <p className="settings-hint">
            Drop plugin folders into <code className="settings-path">{tomePluginsPath}</code> and
            restart to install.
          </p>
        )}
        {plugins.length === 0 && <div className="panel-empty">No plugins installed.</div>}
        <ul className="plugin-list">
          {plugins.map((plugin) => (
            <li key={plugin.manifest.id} className="plugin-row">
              <div className="plugin-meta">
                <span className="plugin-name">{plugin.manifest.name}</span>
                <span className="plugin-version">v{plugin.manifest.version}</span>
                {plugin.manifest.description && (
                  <span className="plugin-desc">{plugin.manifest.description}</span>
                )}
                {plugin.error && <span className="plugin-error">⚠ {plugin.error}</span>}
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  data-testid={`plugin-toggle-${plugin.manifest.id}`}
                  checked={plugin.enabled}
                  onChange={(event) => onToggle(plugin.manifest.id, event.target.checked)}
                />
                <span>{plugin.enabled ? "Enabled" : "Disabled"}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** Returns a label for a conflicting command, if this command's combo clashes. */
function findConflictLabel(
  hotkeys: HotkeySettings,
  commandId: string,
  title: (id: string) => string,
): string | undefined {
  const combo = hotkeys.comboFor(commandId);
  if (!combo) {
    return undefined;
  }
  for (const ids of Object.values(hotkeys.conflicts)) {
    if (ids.includes(commandId)) {
      const other = ids.find((id) => id !== commandId);
      return other ? title(other) : undefined;
    }
  }
  return undefined;
}

/** Full-pane settings surface, shown when a `SETTINGS_TAB_PATH` tab is active. */
export function SettingsView(props: SettingsBodyProps) {
  return (
    <div className="settings-view">
      <div className="settings-view-header">
        <h2>Settings</h2>
      </div>
      <SettingsBody {...props} />
    </div>
  );
}
