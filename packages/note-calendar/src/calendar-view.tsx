import { NoteToolbar, type RendererProps } from "@notes/editor";
import { useUndoStack } from "@notes/web/src/state/undo-context";
import { debounce } from "@notes/core";
import { useCallback, useMemo, useState } from "react";
import { AgendaList } from "./agenda-list";
import { type RichEvent } from "./calendar-format";
import { EventDetails } from "./event-details";
import { MonthGrid } from "./month-grid";
import { useCreateEvent } from "./use-create-event";
import { useDeleteEvent } from "./use-delete-event";
import { useGetEvents } from "./use-get-events";
import { useUpdateEvent } from "./use-update-event";
import { MONTHS, toIso } from "./utils";

type CalendarMode = "month" | "agenda";

export function CalendarView({ value, path }: RendererProps) {
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

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayIso = toIso(new Date());
  const step = (delta: number) => setCursor(new Date(year, month + delta, 1));

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
          <MonthGrid
            year={year}
            month={month}
            todayIso={todayIso}
            events={data?.events}
            onCreateEvent={handleCreateEvent}
            selectedEvent={selectedEvent}
            setSelectedEvent={setSelectedEvent}
          />
        ) : (
          <AgendaList
            todayIso={todayIso}
            events={data?.events}
            selectedEvent={selectedEvent}
            setSelectedEvent={setSelectedEvent}
          />
        )}
      </div>

      {selectedEvent && (
        <EventDetails
          selectedEvent={selectedEvent}
          setSelectedEvent={setSelectedEvent}
          onUpdateEvent={updateEventState}
          onDeleteEvent={handleDeleteEvent}
        />
      )}
    </div>
  );
}
