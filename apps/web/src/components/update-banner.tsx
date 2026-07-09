import { useEffect, useState } from "react";

/**
 * Shows a dismissible banner when an Electron auto-update has been downloaded
 * and is ready to install. Only renders inside the Electron shell.
 */
export function UpdateBanner() {
  if (!window.electronAPI) {
    return null;
  }
  return <UpdateBannerInner />;
}

function UpdateBannerInner() {
  const api = window.electronAPI!;
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    return api.onUpdateDownloaded(() => setReady(true));
  }, [api]);

  if (!ready || dismissed) {
    return null;
  }

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span className="update-banner-msg">A new version of Notes is ready.</span>
      <button
        className="update-banner-btn"
        onClick={() => api.installUpdate()}
      >
        Restart to update
      </button>
      <button
        className="update-banner-dismiss"
        aria-label="Dismiss update notification"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  );
}
