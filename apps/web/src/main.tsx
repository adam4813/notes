import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { ErrorBoundary } from "./components/error-boundary";
import { WorkspaceProvider } from "./state/app-context";
import { ToastProvider } from "./state/toast";
import { UndoStackProvider } from "./state/undo-context";
import "./styles.css";
import "@notes/ui/src/styles.css";
import "@notes/note-mermaid/src/styles.css";
import "@notes/note-calendar/src/styles.css";
import "@notes/note-grid/src/styles.css";
import "@notes/note-tables/src/styles.css";
import "@notes/note-boards/src/styles.css";
import "@notes/note-canvas/src/styles.css";

import { Buffer } from "buffer";

// Safely attach to the global execution context
if (typeof window !== "undefined") {
  window.Buffer = Buffer;
} else if (typeof globalThis !== "undefined") {
  globalThis.Buffer = Buffer;
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root not found");
}

const queryClient = new QueryClient();

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          <ReactQueryDevtools />
          <WorkspaceProvider>
            <UndoStackProvider>
              <App />
            </UndoStackProvider>
          </WorkspaceProvider>
        </QueryClientProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Register the app-shell service worker in production for offline loading.
const isProd = (import.meta as { env?: { PROD?: boolean } }).env?.PROD ?? false;
if (isProd && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
