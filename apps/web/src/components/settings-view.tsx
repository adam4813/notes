import type { PluginInfo } from "@notes/plugin-host";

/** Reserved tab path that renders the settings surface instead of a note. */
export const SETTINGS_TAB_PATH = "notes://settings";

export interface SettingsBodyProps {
  plugins: PluginInfo[];
  theme: string;
  onToggle: (id: string, enabled: boolean) => void;
  openInTab: boolean;
  onOpenInTabChange: (openInTab: boolean) => void;
}

/** Shared settings content, reused by both the modal and the tab view. */
export function SettingsBody({
  plugins,
  theme,
  onToggle,
  openInTab,
  onOpenInTabChange,
}: SettingsBodyProps) {
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
        <h3>Plugins</h3>
        <p className="settings-hint">
          Local, trusted plugins load in-process. See docs/plugins.md to write your own.
        </p>
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

      <section className="settings-section">
        <h3>Appearance</h3>
        <p className="settings-hint">Current theme: {theme}. Toggle it from the ribbon.</p>
      </section>
    </>
  );
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
