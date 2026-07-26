import type { EventBus } from "@notes/core";
import type { RichCard } from "@notes/note-boards";

// ---------------------------------------------------------------------------
// Card command event map — emitted after each mutating card.* command succeeds
// ---------------------------------------------------------------------------

export type CardCommandEventMap = {
  "card.created": { boardPath: string; card: RichCard };
  "card.updated": { boardPath: string; card: RichCard };
  "card.deleted": { boardPath: string; cardId: string };
  "card.moved": { boardPath: string; cardId: string; toColumn: string; toIndex: number };
  "card.duplicated": { boardPath: string; card: RichCard };
};

export function emitCardCreated(
  events: EventBus<CardCommandEventMap>,
  payload: CardCommandEventMap["card.created"],
): Promise<void> {
  return events.emit("card.created", payload);
}

export function emitCardUpdated(
  events: EventBus<CardCommandEventMap>,
  payload: CardCommandEventMap["card.updated"],
): Promise<void> {
  return events.emit("card.updated", payload);
}

export function emitCardDeleted(
  events: EventBus<CardCommandEventMap>,
  payload: CardCommandEventMap["card.deleted"],
): Promise<void> {
  return events.emit("card.deleted", payload);
}

export function emitCardMoved(
  events: EventBus<CardCommandEventMap>,
  payload: CardCommandEventMap["card.moved"],
): Promise<void> {
  return events.emit("card.moved", payload);
}

export function emitCardDuplicated(
  events: EventBus<CardCommandEventMap>,
  payload: CardCommandEventMap["card.duplicated"],
): Promise<void> {
  return events.emit("card.duplicated", payload);
}
