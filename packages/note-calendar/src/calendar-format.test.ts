import { describe, expect, it } from "vitest";
import {
  emptyCalendar,
  newEventId,
  parseCalendar,
  serializeCalendar,
  type RichEvent,
} from "./calendar-format";

describe("calendar-format — new format", () => {
  it("round-trips an empty calendar", () => {
    const { model } = parseCalendar(emptyCalendar());
    const { model: reparsed } = parseCalendar(serializeCalendar(model));
    expect(reparsed.events).toEqual([]);
  });

  it("round-trips a calendar with event IDs", () => {
    const model = { events: ["evt-aaa", "evt-bbb"] };
    const { model: reparsed } = parseCalendar(serializeCalendar(model));
    expect(reparsed.events).toEqual(["evt-aaa", "evt-bbb"]);
  });

  it("newEventId returns unique prefixed IDs", () => {
    const ids = Array.from({ length: 5 }, () => newEventId());
    expect(new Set(ids).size).toBe(5);
    expect(ids.every((id) => id.startsWith("evt-"))).toBe(true);
  });
});

describe("calendar-format — old format migration", () => {
  const OLD_CAL = "---\ntype: calendar\n---\n\n- 2026-02-01 Launch\n- 2026-02-03 14:00 Review\n";

  it("detects old format and returns migratedEvents", () => {
    const { model, migratedEvents } = parseCalendar(OLD_CAL);
    expect(migratedEvents).toBeDefined();
    expect(migratedEvents?.length).toBe(2);
    expect(model.events.length).toBe(2);
  });

  it("migrated events have correct fields", () => {
    const { migratedEvents } = parseCalendar(OLD_CAL);
    const first = migratedEvents?.[0] as RichEvent;
    expect(first.title).toBe("Launch");
    expect(first.date).toBe("2026-02-01");
    expect(first.time).toBeUndefined();
    const second = migratedEvents?.[1] as RichEvent;
    expect(second.time).toBe("14:00");
  });

  it("migrated event IDs match model events list", () => {
    const { model, migratedEvents } = parseCalendar(OLD_CAL);
    expect(model.events).toEqual(migratedEvents!.map((e) => e.id));
  });

  it("new format from serializeCalendar is not detected as old format", () => {
    const { model } = parseCalendar(OLD_CAL);
    const serialized = serializeCalendar(model);
    const reparsed = parseCalendar(serialized);
    expect(reparsed.migratedEvents).toBeUndefined();
  });
});
