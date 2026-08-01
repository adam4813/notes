import { useUndoStack } from "@notes/web/src/state/undo-context";
import { useCallback, useMemo, useState } from "react";
import { MarkdownEditor, NoteToolbar } from "@notes/editor";
import { useUpdateEvent } from "./use-update-event";
import { useCreateEvent } from "./use-create-event";
import { useDeleteEvent } from "./use-delete-event";
import { useGetEvents } from "./use-get-events";
import { type RichEvent } from "./calendar-format";

interface CalendarViewProps {
  value: string;
  onChange?: (markdown: string) => void;
  path: string;
}

type CalendarMode = "month" | "agenda";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
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
  const undoStack = useUndoStack();
  const [selectedEvent, setSelectedEvent] = useState<RichEvent | null>(null);
  const [mode, setMode] = useState<CalendarMode>("month");
  const [cursor, setCursor] = useState(() => new Date());

  const { data, isLoading } = useGetEvents(path, value);
  const { mutateAsync: deleteEvent } = useDeleteEvent(path);
  const { mutateAsync: createEvent } = useCreateEvent(path);
  const { mutateAsync: updateEvent } = useUpdateEvent(path);

  const apiSaveEvent = useMemo(() => debounce(updateEvent, 200), [updateEvent]);

  const updateEventState = useCallback(
    (updated: RichEvent) => {
      const previous = data?.events.find((e) => e.id === updated.id);

      void apiSaveEvent(updated);
      setSelectedEvent(updated);

      undoStack.push({
        label: `Update event "${updated.title}"`,
        undo: async () => {
          if (previous) {
            void apiSaveEvent(previous);
            setSelectedEvent((curr) => (curr?.id === previous.id ? previous : curr));
          }
        },
        redo: async () => {
          void apiSaveEvent(updated);
          setSelectedEvent((curr) => (curr?.id === updated.id ? updated : curr));
        },
      });
    },
    [data?.events, apiSaveEvent, undoStack],
  );

  const handleCreateEvent = useCallback(
    async (date: string) => {
      const event = await createEvent(date);
      setSelectedEvent(event);

      undoStack.push({
        label: `Create event "${event.title}"`,
        undo: async () => {
          await deleteEvent(event.id);
          setSelectedEvent((curr) => (curr?.id === event.id ? null : curr));
        },
        redo: async () => {
          const restoredEvent = await createEvent(date);
          setSelectedEvent(restoredEvent);
        },
      });
    },
    [undoStack, deleteEvent, createEvent],
  );

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      const previous = data?.events.find((e) => e.id === eventId);
      await deleteEvent(eventId);
      setSelectedEvent((curr) => (curr?.id === eventId ? null : curr));

      undoStack.push({
        label: `Delete event "${previous?.title}"`,
        undo: async () => {
          const event = await createEvent(previous?.date ?? "");

          const restoredEvent = previous ? { ...previous, id: event.id } : event;
          setSelectedEvent(restoredEvent);

          if (previous) {
            await updateEvent(restoredEvent);
          }

          return {
            label: `Delete event "${restoredEvent.title}"`,
            redo: async () => {
              await deleteEvent(restoredEvent.id);
              setSelectedEvent((curr) => (curr?.id === restoredEvent.id ? null : curr));
            },
          };
        },
      });
    },
    [data?.events, undoStack, deleteEvent, createEvent, updateEvent],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, RichEvent[]>();
    for (const id of data?.model.events ?? []) {
      const event = data?.events.find((e) => e.id === id);
      if (!event) continue;
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [data?.events, data?.model]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayIso = toIso(new Date());
  const step = (delta: number) => setCursor(new Date(year, month + delta, 1));

  const sortedEvents = useMemo(
    () =>
      data?.events?.toSorted((a, b) =>
        (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")),
      ) ?? [],
    [data?.events],
  );

  return (
    <div className={`calendar-note ${selectedEvent ? "calendar-note--split" : ""}`}>
      <div className="calendar-main">
        <NoteToolbar
          label="Calendar tools"
          className="calendar-toolbar"
          trailing={
            <button
              className="tb-btn"
              onClick={() => void handleCreateEvent(todayIso)}
              aria-label="New event"
            >
              ＋ New event
            </button>
          }
        >
          <div className="calendar-mode-switch" role="tablist" aria-label="Calendar view mode">
            {(["month", "agenda"] as CalendarMode[]).map((option) => (
              <button
                key={option}
                role="tab"
                aria-selected={option === mode}
                className={`tb-btn ${option === mode ? "tb-btn--active" : ""}`}
                onClick={() => setMode(option)}
              >
                {option === "month" ? "Month" : "Agenda"}
              </button>
            ))}
          </div>
          {mode === "month" && (
            <div className="calendar-nav">
              <button className="tb-btn" aria-label="Previous month" onClick={() => step(-1)}>
                ‹
              </button>
              <span className="calendar-title" data-testid="calendar-title">
                {MONTHS[month]} {year}
              </span>
              <button className="tb-btn" aria-label="Next month" onClick={() => step(1)}>
                ›
              </button>
              <button className="tb-btn" onClick={() => setCursor(new Date())}>
                Today
              </button>
            </div>
          )}
        </NoteToolbar>

        {isLoading ? (
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
        ) : (
          <ul className="calendar-agenda" data-testid="calendar-agenda">
            {sortedEvents.map((event) => (
              <li
                key={event.id}
                className={`calendar-agenda-row ${selectedEvent?.id === event.id ? "calendar-agenda-row--selected" : ""}`}
                onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
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
              onClick={() => setSelectedEvent(null)}
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
