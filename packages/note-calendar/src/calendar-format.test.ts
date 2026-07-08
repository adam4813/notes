import { describe, expect, it } from "vitest";
import { emptyCalendar, parseCalendar, serializeCalendar } from "./calendar-format";

describe("calendar-format", () => {
  it("parses dated events with optional times", () => {
    const model = parseCalendar(
      "---\ntype: calendar\n---\n\n- 2026-02-01 Launch\n- 2026-02-03 14:00 Review\n",
    );
    expect(model.events.map((e) => ({ date: e.date, time: e.time, title: e.title }))).toEqual([
      { date: "2026-02-01", time: undefined, title: "Launch" },
      { date: "2026-02-03", time: "14:00", title: "Review" },
    ]);
  });

  it("ignores non-event lines", () => {
    expect(parseCalendar("# Notes\n\nnot an event\n").events).toEqual([]);
  });

  it("serializes events sorted by date and time", () => {
    const md = serializeCalendar({
      frontmatter: "type: calendar",
      events: [
        { id: "b", date: "2026-02-03", time: "14:00", title: "Review" },
        { id: "a", date: "2026-02-01", title: "Launch" },
      ],
    });
    expect(md).toBe("---\ntype: calendar\n---\n\n- 2026-02-01 Launch\n- 2026-02-03 14:00 Review\n");
  });

  it("round-trips emptyCalendar", () => {
    const md = emptyCalendar();
    expect(serializeCalendar(parseCalendar(md))).toBe(md);
  });
});
