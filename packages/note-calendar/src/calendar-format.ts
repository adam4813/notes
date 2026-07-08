const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
const EVENT_RE = /^\s*-\s+(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?\s+(.*)$/;

export interface CalendarEvent {
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Optional 24h time, HH:MM. */
  time?: string;
  title: string;
}

export interface CalendarModel {
  frontmatter: string;
  events: CalendarEvent[];
}

let counter = 0;
export function newEventId(): string {
  counter += 1;
  return `evt-${Date.now().toString(36)}-${counter}`;
}

/** Parses a markdown-backed calendar (frontmatter + `- DATE [TIME] Title` lines). */
export function parseCalendar(markdown: string): CalendarModel {
  const fm = FRONTMATTER_RE.exec(markdown);
  const frontmatter = fm ? fm[1] : "type: calendar";
  const body = fm ? markdown.slice(fm[0].length) : markdown;

  const events: CalendarEvent[] = [];
  for (const line of body.split(/\r?\n/)) {
    const match = EVENT_RE.exec(line);
    if (match) {
      const title = match[3].trim();
      if (title) {
        events.push({
          id: newEventId(),
          date: match[1],
          ...(match[2] ? { time: match[2] } : {}),
          title,
        });
      }
    }
  }
  return { frontmatter, events };
}

function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1;
  }
  return (a.time ?? "").localeCompare(b.time ?? "");
}

export function serializeCalendar(model: CalendarModel): string {
  const body = [...model.events]
    .sort(compareEvents)
    .map((event) => `- ${event.date}${event.time ? ` ${event.time}` : ""} ${event.title}`)
    .join("\n");
  return `---\n${model.frontmatter}\n---\n\n${body}${body ? "\n" : ""}`;
}

export function emptyCalendar(): string {
  return serializeCalendar({
    frontmatter: "type: calendar",
    events: [
      { id: newEventId(), date: "2026-01-01", title: "New Year" },
      { id: newEventId(), date: "2026-01-15", time: "09:30", title: "Kickoff meeting" },
    ],
  });
}
