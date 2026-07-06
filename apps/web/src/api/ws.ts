export interface TomeChange {
  kind: "created" | "modified" | "deleted";
  path: string;
}

/** Subscribes to `/ws` and invokes the callback on each Tome change. Returns a disposer. */
export function connectTomeChanges(onChange: (change: TomeChange) => void): () => void {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);

  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data as string) as { type?: string; payload?: TomeChange };
      if (message.type === "tome:change" && message.payload) {
        onChange(message.payload);
      }
    } catch {
      // Ignore malformed frames.
    }
  });

  return () => socket.close();
}
