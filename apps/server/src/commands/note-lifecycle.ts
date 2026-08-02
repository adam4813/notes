import { EventBus } from "@notes/core";

export type NoteLifecycleEventMap = {
  "note.path-moved": {
    fromPath: string;
    toPath: string;
    noteType: string | null;
  };
};

export function emitNotePathMoved(
  events: EventBus<NoteLifecycleEventMap>,
  payload: NoteLifecycleEventMap["note.path-moved"],
): Promise<void> {
  return events.emit("note.path-moved", payload);
}
