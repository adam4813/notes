import { MarkdownEditor } from "@notes/editor";
import type { RichEvent } from "./calendar-format";

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 0, label: "All day" },
];

export function EventDetails({
  selectedEvent,
  setSelectedEvent,
  onUpdateEvent,
  onDeleteEvent,
}: {
  selectedEvent: RichEvent;
  setSelectedEvent: (event: RichEvent | null) => void;
  onUpdateEvent: (event: RichEvent) => void;
  onDeleteEvent: (eventId: string) => void;
}) {
  return (
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
            onChange={(e) => onUpdateEvent({ ...selectedEvent, title: e.target.value })}
            placeholder="Event title"
          />
        </label>

        <label className="calendar-event-field">
          <span>Date</span>
          <input
            type="date"
            value={selectedEvent.date}
            onChange={(e) => onUpdateEvent({ ...selectedEvent, date: e.target.value })}
          />
        </label>

        <label className="calendar-event-field">
          <span>Time</span>
          <input
            type="time"
            value={selectedEvent.time ?? ""}
            onChange={(e) =>
              onUpdateEvent({
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
              onUpdateEvent({
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
              onUpdateEvent({
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
          onChange={(body) => onUpdateEvent({ ...selectedEvent, body })}
        />
      </div>

      <div className="calendar-event-panel-footer">
        <button
          className="calendar-event-delete"
          onClick={() => void onDeleteEvent(selectedEvent.id)}
        >
          🗑 Delete event
        </button>
      </div>
    </div>
  );
}
