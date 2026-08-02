import { useMemo } from "react";
import type { RichEvent } from "./calendar-format";

export function AgendaList({
  todayIso,
  events = [],
  selectedEvent,
  setSelectedEvent,
}: {
  todayIso: string;
  events?: RichEvent[];
  selectedEvent: RichEvent | null;
  setSelectedEvent: (event: RichEvent | null) => void;
}) {
  const sortedEvents = useMemo(
    () =>
      events.toSorted((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? ""))),
    [events],
  );

  return (
    <ul className="calendar-agenda" data-testid="calendar-agenda">
      {sortedEvents.map((event) => (
        <li
          key={event.id}
          className={`calendar-agenda-row ${selectedEvent?.id === event.id ? "calendar-agenda-row--selected" : ""}`}
          onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
        >
          <span
            className={`calendar-agenda-date ${todayIso === event.date ? "calendar-agenda-date--today" : ""}`}
          >
            {event.date}
            {event.time ? ` ${event.time}` : ""}
          </span>
          <span className="calendar-agenda-title">
            {event.title}
            {event.body && <span className="calendar-event-dot" title="Has notes" />}
          </span>
        </li>
      ))}
      {sortedEvents.length === 0 && <li className="panel-empty">No events yet.</li>}
    </ul>
  );
}
