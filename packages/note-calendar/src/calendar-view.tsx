import { useEffect, useMemo, useRef, useState } from "react";
import {
  newEventId,
  parseCalendar,
  serializeCalendar,
  type CalendarEvent,
  type CalendarModel,
} from "./calendar-format";

interface CalendarViewProps {
  value: string;
  onChange: (markdown: string) => void;
}

type CalendarMode = "month" | "agenda";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Six-week grid of dates covering the given month (Sunday-first). */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function CalendarView({ value, onChange }: CalendarViewProps) {
  const [model, setModel] = useState<CalendarModel>(() => parseCalendar(value));
  const [mode, setMode] = useState<CalendarMode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [composing, setComposing] = useState<{ date: string; title: string; time: string } | null>(
    null,
  );
  const lastSerialized = useRef(value);

  useEffect(() => {
    if (value !== lastSerialized.current) {
      setModel(parseCalendar(value));
      lastSerialized.current = value;
    }
  }, [value]);

  const commit = (events: CalendarEvent[]) => {
    const next = { ...model, events };
    setModel(next);
    const markdown = serializeCalendar(next);
    lastSerialized.current = markdown;
    onChange(markdown);
  };

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of model.events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [model.events]);

  const startAdd = (date: string) => setComposing({ date, title: "", time: "" });

  const saveComposing = () => {
    if (!composing || !composing.title.trim()) {
      setComposing(null);
      return;
    }
    commit([
      ...model.events,
      {
        id: newEventId(),
        date: composing.date,
        ...(composing.time ? { time: composing.time } : {}),
        title: composing.title.trim(),
      },
    ]);
    setComposing(null);
  };

  const removeEvent = (id: string) => commit(model.events.filter((event) => event.id !== id));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayIso = toIso(new Date());
  const step = (delta: number) => setCursor(new Date(year, month + delta, 1));

  return (
    <div className="calendar-note">
      <div className="calendar-toolbar">
        <div className="calendar-mode-switch" role="tablist" aria-label="Calendar view mode">
          {(["month", "agenda"] as CalendarMode[]).map((option) => (
            <button
              key={option}
              role="tab"
              aria-selected={option === mode}
              className={`mode-btn ${option === mode ? "mode-btn--active" : ""}`}
              onClick={() => setMode(option)}
            >
              {option === "month" ? "Month" : "Agenda"}
            </button>
          ))}
        </div>
        {mode === "month" && (
          <div className="calendar-nav">
            <button className="btn-ghost" aria-label="Previous month" onClick={() => step(-1)}>
              ‹
            </button>
            <span className="calendar-title" data-testid="calendar-title">
              {MONTHS[month]} {year}
            </span>
            <button className="btn-ghost" aria-label="Next month" onClick={() => step(1)}>
              ›
            </button>
            <button className="btn-ghost" onClick={() => setCursor(new Date())}>
              Today
            </button>
          </div>
        )}
        {mode === "agenda" && (
          <button className="btn-ghost" onClick={() => startAdd(todayIso)}>
            ＋ Add event
          </button>
        )}
      </div>

      {composing && (
        <div className="calendar-compose" data-testid="calendar-compose">
          <span className="calendar-compose-date">{composing.date}</span>
          <input
            className="calendar-compose-title"
            data-testid="calendar-compose-title"
            autoFocus
            placeholder="Event title"
            value={composing.title}
            onChange={(event) =>
              setComposing((prev) => (prev ? { ...prev, title: event.target.value } : prev))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                saveComposing();
              } else if (event.key === "Escape") {
                setComposing(null);
              }
            }}
          />
          <input
            className="calendar-compose-time"
            data-testid="calendar-compose-time"
            type="time"
            aria-label="Event time"
            value={composing.time}
            onChange={(event) =>
              setComposing((prev) => (prev ? { ...prev, time: event.target.value } : prev))
            }
          />
          <button className="calendar-compose-add" data-testid="calendar-compose-add" onClick={saveComposing}>
            Add
          </button>
          <button className="btn-ghost" onClick={() => setComposing(null)}>
            Cancel
          </button>
        </div>
      )}

      {mode === "month" ? (
        <div className="calendar-grid" data-testid="calendar-grid">
          {WEEKDAYS.map((day) => (
            <div key={day} className="calendar-weekday">
              {day}
            </div>
          ))}
          {monthGrid(year, month).map((date) => {
            const iso = toIso(date);
            const inMonth = date.getMonth() === month;
            const events = byDate.get(iso) ?? [];
            return (
              <button
                key={iso}
                className={`calendar-cell ${inMonth ? "" : "calendar-cell--muted"} ${
                  iso === todayIso ? "calendar-cell--today" : ""
                }`}
                onClick={() => startAdd(iso)}
              >
                <span className="calendar-daynum">{date.getDate()}</span>
                {events.map((event) => (
                  <span
                    key={event.id}
                    className="calendar-event"
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      removeEvent(event.id);
                    }}
                    title="Click to remove"
                  >
                    {event.time ? `${event.time} ` : ""}
                    {event.title}
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      ) : (
        <ul className="calendar-agenda" data-testid="calendar-agenda">
          {[...model.events]
            .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")))
            .map((event) => (
              <li key={event.id} className="calendar-agenda-row">
                <span className="calendar-agenda-date">
                  {event.date}
                  {event.time ? ` ${event.time}` : ""}
                </span>
                <span className="calendar-agenda-title">{event.title}</span>
                <button
                  className="calendar-agenda-remove"
                  aria-label={`Remove ${event.title}`}
                  onClick={() => removeEvent(event.id)}
                >
                  ×
                </button>
              </li>
            ))}
          {model.events.length === 0 && <li className="panel-empty">No events yet.</li>}
        </ul>
      )}
    </div>
  );
}
