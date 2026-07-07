import { SettingsBody, type SettingsBodyProps } from "./settings-view";

interface SettingsModalProps extends SettingsBodyProps {
  onClose: () => void;
}

export function SettingsModal({ onClose, ...body }: SettingsModalProps) {
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="btn-ghost" aria-label="Close settings" onClick={onClose}>
            ×
          </button>
        </div>
        <SettingsBody {...body} />
      </div>
    </div>
  );
}
