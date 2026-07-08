import { useToasts } from "../state/toast";

const ICON: Record<string, string> = {
  info: "ℹ️",
  success: "✅",
  error: "⚠️",
};

/** Bottom-right stack of transient notifications with optional actions. */
export function Toaster() {
  const { toasts, dismiss } = useToasts();
  if (toasts.length === 0) {
    return null;
  }
  return (
    <div className="toaster" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.kind}`} role="status">
          <span className="toast-icon" aria-hidden>
            {ICON[toast.kind]}
          </span>
          <span className="toast-message">{toast.message}</span>
          {toast.action && (
            <button
              className="toast-action"
              onClick={() => {
                toast.action?.run();
                dismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button className="toast-close" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
