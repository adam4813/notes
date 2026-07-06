import websocketPlugin, { type WebSocket } from "@fastify/websocket";
import type { EventBus } from "@notes/core";
import type { TomeEventMap } from "@notes/tome";
import type { FastifyInstance } from "fastify";

/**
 * Registers the `/ws` channel and broadcasts normalized Tome changes to every
 * connected client (Observer → transport bridge).
 */
export async function registerWebSocket(
  app: FastifyInstance,
  events: EventBus<TomeEventMap>,
): Promise<void> {
  await app.register(websocketPlugin);

  const sockets = new Set<WebSocket>();

  app.get("/ws", { websocket: true }, (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  events.on("tome:change", (change) => {
    const message = JSON.stringify({ type: "tome:change", payload: change });
    for (const socket of sockets) {
      try {
        socket.send(message);
      } catch {
        sockets.delete(socket);
      }
    }
  });
}
