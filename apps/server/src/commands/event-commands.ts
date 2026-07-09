import type { CommandBus } from "@notes/core";
import type { RichEvent } from "@notes/note-calendar";
import { newEventId, parseCalendar, serializeCalendar } from "@notes/note-calendar";
import type { Tome } from "@notes/tome";
import { deleteEvent, listEvents, readEvent, writeEvent } from "./event-store";

interface GetTome {
  (): Tome;
}

async function readCalendarModel(calendarPath: string, tome: Tome) {
  const content = await tome.read(calendarPath);
  return parseCalendar(content);
}

async function saveCalendarModel(
  calendarPath: string,
  model: import("@notes/note-calendar").CalendarModel,
  tome: Tome,
): Promise<void> {
  await tome.write(calendarPath, serializeCalendar(model));
}

/**
 * Registers event CRUD commands. All commands receive `calendarPath` (relative
 * tome path to the `.md` calendar file) and operate on the companion dot-folder.
 */
export function registerEventCommands(bus: CommandBus, getTome: GetTome): void {
  // ------------------------------------------------------------------
  // event.list — fetch all RichEvents for a calendar, sorted by date+time
  // ------------------------------------------------------------------
  bus.register<{ calendarPath: string }, { events: RichEvent[] }>({
    name: "event.list",
    handler: async ({ calendarPath }) => {
      const tome = getTome();
      // Auto-migrate old format on first access
      const { model, migratedEvents } = await readCalendarModel(calendarPath, tome);
      if (migratedEvents?.length) {
        for (const event of migratedEvents) {
          await writeEvent(calendarPath, event, tome);
        }
        await saveCalendarModel(calendarPath, model, tome);
      }
      const events = await listEvents(calendarPath, tome);
      // Sort by date + time
      return {
        events: [...events].sort((a, b) =>
          (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")),
        ),
      };
    },
  });

  // ------------------------------------------------------------------
  // event.get — fetch a single event
  // ------------------------------------------------------------------
  bus.register<{ calendarPath: string; eventId: string }, RichEvent>({
    name: "event.get",
    handler: async ({ calendarPath, eventId }) => {
      return readEvent(calendarPath, eventId, getTome());
    },
  });

  // ------------------------------------------------------------------
  // event.create — create a new event on the given date
  // ------------------------------------------------------------------
  bus.register<{ calendarPath: string; date: string }, RichEvent>({
    name: "event.create",
    handler: async ({ calendarPath, date }) => {
      const tome = getTome();
      const { model } = await readCalendarModel(calendarPath, tome);
      const id = newEventId();
      const event: RichEvent = { id, title: "New event", date, body: "" };
      await writeEvent(calendarPath, event, tome);
      model.events.push(id);
      await saveCalendarModel(calendarPath, model, tome);
      return event;
    },
  });

  // ------------------------------------------------------------------
  // event.update — write event content
  // ------------------------------------------------------------------
  bus.register<{ calendarPath: string; event: RichEvent }, RichEvent>({
    name: "event.update",
    handler: async ({ calendarPath, event }) => {
      await writeEvent(calendarPath, event, getTome());
      return event;
    },
  });

  // ------------------------------------------------------------------
  // event.delete — remove event file + update calendar
  // ------------------------------------------------------------------
  bus.register<{ calendarPath: string; eventId: string }, { eventId: string }>({
    name: "event.delete",
    handler: async ({ calendarPath, eventId }) => {
      const tome = getTome();
      await deleteEvent(calendarPath, eventId, tome);
      const { model } = await readCalendarModel(calendarPath, tome);
      model.events = model.events.filter((id) => id !== eventId);
      await saveCalendarModel(calendarPath, model, tome);
      return { eventId };
    },
  });
}
