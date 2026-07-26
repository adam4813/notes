import type { EventBus } from "@notes/core";
import type { RichEvent } from "@notes/note-calendar";

// ---------------------------------------------------------------------------
// Calendar event command event map — emitted after mutating event.* commands
// ---------------------------------------------------------------------------

export type CalendarEventCommandEventMap = {
  "calendar-event.created": { calendarPath: string; event: RichEvent };
  "calendar-event.updated": { calendarPath: string; event: RichEvent };
  "calendar-event.deleted": { calendarPath: string; eventId: string };
};

export function emitCalendarEventCreated(
  events: EventBus<CalendarEventCommandEventMap>,
  payload: CalendarEventCommandEventMap["calendar-event.created"],
): Promise<void> {
  return events.emit("calendar-event.created", payload);
}

export function emitCalendarEventUpdated(
  events: EventBus<CalendarEventCommandEventMap>,
  payload: CalendarEventCommandEventMap["calendar-event.updated"],
): Promise<void> {
  return events.emit("calendar-event.updated", payload);
}

export function emitCalendarEventDeleted(
  events: EventBus<CalendarEventCommandEventMap>,
  payload: CalendarEventCommandEventMap["calendar-event.deleted"],
): Promise<void> {
  return events.emit("calendar-event.deleted", payload);
}
