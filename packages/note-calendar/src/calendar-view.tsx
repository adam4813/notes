import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownEditor } from "@notes/editor";
import { parseCalendar, type RichEvent } from "./calendar-format";

interface CalendarViewProps {
  value: string;
  onChange?: (markdown: string) => void;
  path: string;
}

type CalendarMode = "month" | "agenda";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 0, label: "All day" },
];

function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function CalendarView({ value, path }: CalendarViewProps) {
  const [eventIds, setEventIds] = useState<string[]>(() => parseCalendar(value).model.events);
  const [events, setEvents] = useState<Map<string, RichEvent>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<CalendarMode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const lastValue = useRef(value);

  // Sync event IDs when value changes from file watcher
  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value;
      setEventIds(parseCalendar(value).model.events);
    }
  }, [value]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events?calendarPath=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as { events: RichEvent[] };
      setEvents(new Map(data.events.map((e) => [e.id, e])));
      // Re-read calendar file to pick up any migration changes
      const fileRes = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
      if (fileRes.ok) {
        const fileData = (await fileRes.json()) as { content: string };
        const { model } = parseCalendar(fileData.content);
        setEventIds(model.events);
        lastValue.current = fileData.content;
      }
    } catch {
      // Swallow — keep whatever state we have
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const apiSaveEvent = useMemo(
    () =>
      debounce(async (event: RichEvent) => {
        await fetch("/api/event/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarPath: path, event }),
        });
      }, 800),
    [path],
  );

  const updateEventState = (updated: RichEvent) => {
    setEvents((prev) => new Map(prev).set(updated.id, updated));
    void apiSaveEvent(updated);
  };

  const handleCreateEvent = async (date: string) => {
    const res = await fetch("/api/event/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarPath: path, date }),
    });
    if (!res.ok) return;
    const event = (await res.json()) as RichEvent;
    setEvents((prev) => new Map(prev).set(event.id, event));
    setEventIds((prev) => [...prev, event.id]);
    setSelectedId(event.id);
  };

  const handleDeleteEvent = async (eventId: string) => {
    await fetch(
      `/api/event?calendarPath=${encodeURIComponent(path)}&eventId=${encodeURIComponent(eventId)}`,
      { method: "DELETE" },
    );
    setEvents((prev) => {
      const next = new Map(prev);
      next.delete(eventId);
      return next;
    });
    setEventIds((prev) => prev.filter((id) => id !== eventId));
    if (selectedId === eventId) setSelectedId(null);
  };

  const selectedEvent = selectedId ? events.get(selectedId) : null;

  const byDate = useMemo(() => {
    const map = new Map<string, RichEvent[]>();
    for (const id of eventIds) {
      const event = events.get(id);
      if (!event) continue;
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [eventIds, events]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayIso = toIso(new Date());
  const step = (delta: number) => setCursor(new Date(year, month + delta, 1));

  const sortedEvents = useMemo(
    () =>
      [...events.values()].sort((a, b) =>
        (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")),
      ),
    [events],
  );

  return (
    <div className={`calendar-note ${selectedEvent ? "calendar-note--split" : ""}`}>
      <div className="calendar-main">
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
          <button
            className="btn-ghost"
            onClick={() => void handleCreateEvent(todayIso)}
            aria-label="New event"
          >
            ＋ New event
          </button>
        </div>

        {loading ? (
          <div className="calendar-loading">Loading events…</div>
        ) : mode === "month" ? (
          <div className="calendar-grid" data-testid="calendar-grid">
            {WEEKDAYS.map((day) => (
              <div key={day} className="calendar-weekday">
                {day}
              </div>
            ))}
            {monthGrid(year, month).map((date) => {
              const iso = toIso(date);
              const inMonth = date.getMonth() === month;
              const dayEvents = byDate.get(iso) ?? [];
              return (
                <button
                  key={iso}
                  className={`calendar-cell ${inMonth ? "" : "calendar-cell--muted"} ${
                    iso === todayIso ? "calendar-cell--today" : ""
                  }`}
                  onClick={() => void handleCreateEvent(iso)}
                >
                  <span className="calendar-daynum">{date.getDate()}</span>
                  {dayEvents.map((event) => (
                    <span
                      key={event.id}
                      className={`calendar-event ${event.body ? "calendar-event--has-notes" : ""} ${
                        selectedId === event.id ? "calendar-event--selected" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(selectedId === event.id ? null : event.id);
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
        ) : (
          <ul className="calendar-agenda" data-testid="calendar-agenda">
            {sortedEvents.map((event) => (
              <li
                key={event.id}
                className={`calendar-agenda-row ${selectedId === event.id ? "calendar-agenda-row--selected" : ""}`}
                onClick={() => setSelectedId(selectedId === event.id ? null : event.id)}
              >
                <span className="calendar-agenda-date">
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
        )}
      </div>

      {selectedEvent && (
        <div className="calendar-event-panel">
          <div className="calendar-event-panel-header">
            <span className="calendar-event-panel-title">Edit Event</span>
            <button
              className="calendar-event-panel-close"
              aria-label="Close event editor"
              onClick={() => setSelectedId(null)}
            >
              ×
            </button>
          </div>

          <div className="calendar-event-fields">
            <label className="calendar-event-field">
              <span>Title</span>
              <input
                className="calendar-event-title-input"
                value={selectedEvent.title}
                onChange={(e) => updateEventState({ ...selectedEvent, title: e.target.value })}
                placeholder="Event title"
              />
            </label>

            <label className="calendar-event-field">
              <span>Date</span>
              <input
                type="date"
                value={selectedEvent.date}
                onChange={(e) => updateEventState({ ...selectedEvent, date: e.target.value })}
              />
            </label>

            <label className="calendar-event-field">
              <span>Time</span>
              <input
                type="time"
                value={selectedEvent.time ?? ""}
                onChange={(e) =>
                  updateEventState({
                    ...selectedEvent,
                    time: e.target.value || undefined,
                    allDay: !e.target.value,
                  })
                }
              />
            </label>

            <label className="calendar-event-field">
              <span>Duration</span>
              <select
                value={selectedEvent.duration ?? 60}
                onChange={(e) =>
                  updateEventState({
                    ...selectedEvent,
                    duration: Number(e.target.value) || undefined,
                    allDay: Number(e.target.value) === 0,
                  })
                }
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="calendar-event-field">
              <span>Location</span>
              <input
                type="text"
                value={selectedEvent.location ?? ""}
                onChange={(e) =>
                  updateEventState({
                    ...selectedEvent,
                    location: e.target.value || undefined,
                  })
                }
                placeholder="Location or URL"
              />
            </label>
          </div>

          <div className="calendar-event-body">
            <MarkdownEditor
              value={selectedEvent.body}
              mode="rendered"
              onChange={(body) => updateEventState({ ...selectedEvent, body })}
            />
          </div>

          <div className="calendar-event-panel-footer">
            <button
              className="calendar-event-delete"
              onClick={() => void handleDeleteEvent(selectedEvent.id)}
            >
              🗑 Delete event
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
