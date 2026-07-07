import type { PluginInfo } from "@notes/plugin-host";

interface SettingsModalProps {
  plugins: PluginInfo[];
  theme: string;
  onToggle: (id: string, enabled: boolean) => void;
  onClose: () => void;
}

export function SettingsModal({ plugins, theme, onToggle, onClose }: SettingsModalProps) {
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="btn-ghost" aria-label="Close settings" onClick={onClose}>
            ×
          </button>
        </div>

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
      </div>
    </div>
  );
}
