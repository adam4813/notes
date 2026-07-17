import { describe, expect, it } from "vitest";
import { emptyCalendar, newEventId, parseCalendar, serializeCalendar } from "./calendar-format";

describe("calendar-format — new format", () => {
  it("round-trips an empty calendar", () => {
    const model = parseCalendar(emptyCalendar());
    const reparsed = parseCalendar(serializeCalendar(model));
    expect(reparsed.events).toEqual([]);
  });

  it("round-trips a calendar with event IDs", () => {
    const model = { frontmatter: [], events: ["evt-aaa", "evt-bbb"] };
    const reparsed = parseCalendar(serializeCalendar(model));
    expect(reparsed.events).toEqual(["evt-aaa", "evt-bbb"]);
  });

  it("newEventId returns unique prefixed IDs", () => {
    const ids = Array.from({ length: 5 }, () => newEventId());
    expect(new Set(ids).size).toBe(5);
    expect(ids.every((id) => id.startsWith("evt-"))).toBe(true);
  });
});
