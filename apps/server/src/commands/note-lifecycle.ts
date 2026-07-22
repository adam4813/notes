import type { EventBus } from "@notes/core";

export interface NotePathMovedPayload {
  fromPath: string;
  toPath: string;
  noteType: string | null;
}

export type NoteLifecycleEventMap = {
  "note.path-moved": NotePathMovedPayload;
};

export function emitNotePathMoved(
  events: EventBus<NoteLifecycleEventMap>,
  payload: NotePathMovedPayload,
): Promise<void> {
  return events.emit("note.path-moved", payload);
}
