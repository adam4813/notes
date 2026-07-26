import type { CalendarEventCommandEventMap } from "./calendar-event-events";
import type { CardCommandEventMap } from "./card-events";
import type { FileCommandEventMap } from "./file-events";
import type { NoteLifecycleEventMap } from "./note-lifecycle";

/**
 * Union of all server-side event maps. Plugins and internal consumers can subscribe
 * to events on an `EventBus<ServerEventMap>` to react to any mutation.
 *
 * Use this type when constructing the shared `EventBus` in the server setup so
 * all emitters and listeners are compatible.
 */
export type ServerEventMap = NoteLifecycleEventMap &
  FileCommandEventMap &
  CardCommandEventMap &
  CalendarEventCommandEventMap;
