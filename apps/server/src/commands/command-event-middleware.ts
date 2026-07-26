import type { EventBus, Middleware } from "@notes/core";
import type { RichCard } from "@notes/note-boards";
import type { RichEvent } from "@notes/note-calendar";
import type { ServerEventMap } from "./server-events";

/**
 * Command bus middleware that emits typed domain events after any command that
 * has `mutates: true` succeeds. Plugins and internal listeners can subscribe
 * to `EventBus<ServerEventMap>` to react to any mutation without coupling to
 * specific command implementations.
 *
 * Event emission follows the `note-lifecycle.ts` pattern: typed event maps per
 * domain, collected into a single `ServerEventMap` union.
 */
export function createCommandEventMiddleware(events: EventBus<ServerEventMap>): Middleware {
  return async (invocation, next) => {
    const result = await next();

    if (!invocation.ctx) return result;

    const command = invocation as { name: string; payload: unknown };
    const { name, payload } = command;

    switch (name) {
      // ------------------------------------------------------------------
      // file.* mutations
      // ------------------------------------------------------------------
      case "file.create":
      case "file.createBinary": {
        const p = payload as { path: string };
        await events.emit("file.created", { path: p.path });
        break;
      }
      case "file.write": {
        const p = payload as { path: string };
        await events.emit("file.written", { path: p.path });
        break;
      }
      case "file.delete": {
        const p = payload as { path: string };
        await events.emit("file.deleted", { path: p.path });
        break;
      }
      case "file.rename":
      case "file.move": {
        const p = payload as { from: string; to: string };
        await events.emit("file.renamed", { from: p.from, to: p.to });
        // note.path-moved is emitted separately inside file-commands.ts
        break;
      }
      case "file.mkdir": {
        const p = payload as { path: string };
        await events.emit("file.mkdir", { path: p.path });
        break;
      }

      // ------------------------------------------------------------------
      // card.* mutations
      // ------------------------------------------------------------------
      case "card.create": {
        const p = payload as { boardPath: string };
        const card = result as RichCard;
        await events.emit("card.created", { boardPath: p.boardPath, card });
        break;
      }
      case "card.update": {
        const p = payload as { boardPath: string; card: RichCard };
        await events.emit("card.updated", { boardPath: p.boardPath, card: p.card });
        break;
      }
      case "card.delete": {
        const p = payload as { boardPath: string; cardId: string };
        await events.emit("card.deleted", { boardPath: p.boardPath, cardId: p.cardId });
        break;
      }
      case "card.move": {
        const p = payload as {
          boardPath: string;
          cardId: string;
          toColumn: string;
          toIndex: number;
        };
        await events.emit("card.moved", {
          boardPath: p.boardPath,
          cardId: p.cardId,
          toColumn: p.toColumn,
          toIndex: p.toIndex,
        });
        break;
      }
      case "card.duplicate": {
        const p = payload as { boardPath: string };
        const card = result as RichCard;
        await events.emit("card.duplicated", { boardPath: p.boardPath, card });
        break;
      }

      // ------------------------------------------------------------------
      // event.* (calendar events) mutations
      // ------------------------------------------------------------------
      case "event.create": {
        const p = payload as { calendarPath: string };
        const event = result as RichEvent;
        await events.emit("calendar-event.created", { calendarPath: p.calendarPath, event });
        break;
      }
      case "event.update": {
        const p = payload as { calendarPath: string; event: RichEvent };
        await events.emit("calendar-event.updated", {
          calendarPath: p.calendarPath,
          event: p.event,
        });
        break;
      }
      case "event.delete": {
        const p = payload as { calendarPath: string; eventId: string };
        await events.emit("calendar-event.deleted", {
          calendarPath: p.calendarPath,
          eventId: p.eventId,
        });
        break;
      }
    }

    return result;
  };
}
