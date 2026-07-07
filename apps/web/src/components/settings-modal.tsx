import type { PluginInfo } from "@notes/plugin-host";
import { SettingsBody } from "./settings-view";

interface SettingsModalProps {
  plugins: PluginInfo[];
  theme: string;
  onToggle: (id: string, enabled: boolean) => void;
  openInTab: boolean;
  onOpenInTabChange: (openInTab: boolean) => void;
  onClose: () => void;
}

export function SettingsModal({
  plugins,
  theme,
  onToggle,
  openInTab,
  onOpenInTabChange,
  onClose,
}: SettingsModalProps) {
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="btn-ghost" aria-label="Close settings" onClick={onClose}>
            ×
          </button>
        </div>
        <SettingsBody
          plugins={plugins}
          theme={theme}
          onToggle={onToggle}
          openInTab={openInTab}
          onOpenInTabChange={onOpenInTabChange}
        />
      </div>
    </div>
  );
}
