import { useEffect, useState } from "react";
import { APP_NAME, TERMS } from "@notes/shared";

type ServerStatus = "checking" | "ok" | "offline";

interface HealthResponse {
  status?: string;
}

export function App() {
  const [status, setStatus] = useState<ServerStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/health")
      .then((res) => (res.ok ? (res.json() as Promise<HealthResponse>) : Promise.reject()))
      .then((body) => {
        if (!cancelled) {
          setStatus(body.status === "ok" ? "ok" : "offline");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("offline");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell">
      <h1>{APP_NAME}</h1>
      <p className="tagline">
        Local-first notes — {TERMS.tower} ▸ {TERMS.tome}.
      </p>
      <p>
        Server:{" "}
        <span data-testid="server-status" className={`status status--${status}`}>
          {status}
        </span>
      </p>
    </main>
  );
}
