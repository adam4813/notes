import { useMemo } from "react";
import type { RichEvent } from "./calendar-format";
import { WEEKDAYS, toIso } from "./utils";

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function MonthGrid({
  year,
  month,
  todayIso,
  events = [],
  onCreateEvent,
  selectedEvent,
  setSelectedEvent,
}: {
  year: number;
  month: number;
  todayIso: string;
  events?: RichEvent[];
  onCreateEvent: (iso: string) => void;
  selectedEvent: RichEvent | null;
  setSelectedEvent: (event: RichEvent | null) => void;
}) {
  const gridDates = useMemo(() => monthGrid(year, month), [month, year]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, RichEvent[]>();
    for (const event of events ?? []) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  return (
    <div className="calendar-grid" data-testid="calendar-grid">
      {WEEKDAYS.map((day) => (
        <div key={day} className="calendar-weekday">
          {day}
        </div>
      ))}
      {gridDates.map((date) => {
        const iso = toIso(date);
        const inMonth = date.getMonth() === month;
        const dayEvents = eventsByDate.get(iso) ?? [];
        return (
          <button
            key={iso}
            className={`calendar-cell ${inMonth ? "" : "calendar-cell--muted"} ${
              iso === todayIso ? "calendar-cell--today" : ""
            }`}
            onClick={() => void onCreateEvent(iso)}
          >
            <span className="calendar-daynum">{date.getDate()}</span>
            {dayEvents.map((event) => (
              <span
                key={event.id}
                className={`calendar-event ${event.body ? "calendar-event--has-notes" : ""} ${
                  selectedEvent?.id === event.id ? "calendar-event--selected" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEvent(selectedEvent?.id === event.id ? null : event);
                }}
                title={event.time ? `${event.time} — ${event.title}` : event.title}
              >
                {event.time ? `${event.time} ` : ""}
                {event.title}
              </span>
            ))}
          </button>
        );
      })}
    </div>
  );
}
