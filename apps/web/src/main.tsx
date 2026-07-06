import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { WorkspaceProvider } from "./state/app-context";
import "./styles.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root not found");
}

createRoot(container).render(
  <StrictMode>
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </StrictMode>,
);
