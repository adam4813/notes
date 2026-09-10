import {
  buildContent,
  FrontmatterProp,
  getFrontmatterField,
  parseFrontmatter,
} from "@notes/web/src/lib/frontmatter";

/** Returns the companion dot-folder for a calendar's event files (relative to tome root). */
export function eventDotFolder(calendarPath: string): string {
  const lastSlash = calendarPath.lastIndexOf("/");
  const dir = lastSlash !== -1 ? calendarPath.slice(0, lastSlash + 1) : "";
  const filename = lastSlash !== -1 ? calendarPath.slice(lastSlash + 1) : calendarPath;
  const base = filename.endsWith(".md") ? filename.slice(0, -3) : filename;
  return `${dir}.${base}.events`;
}

/** Returns the file path for a single event within a calendar (relative to tome root). */
export function eventFilePath(calendarPath: string, eventId: string): string {
  return `${eventDotFolder(calendarPath)}/${eventId}.md`;
}

export interface RichEvent {
  id: string;
  title: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Optional 24h time, HH:MM. */
  time?: string;
  /** Duration in minutes. */
  duration?: number;
  location?: string;
  allDay?: boolean;
  /** Raw markdown body (after frontmatter). */
  body: string;
  frontmatter?: FrontmatterProp[];
}

export interface CalendarModel {
  frontmatter: FrontmatterProp[];
  /** Ordered list of event IDs. */
  events: string[];
}

let counter = 0;
export function newEventId(): string {
  counter += 1;
  return `evt-${Date.now().toString(36)}-${counter}`;
}

/**
 * Parses a calendar file. If the file used the old line-item format,
 * `migratedEvents` is populated with stub RichEvents for the server to persist.
 */
export function parseCalendar(markdown: string): CalendarModel {
  const parsed = parseFrontmatter(markdown);

  return {
    frontmatter:
      parsed.props.length > 0
        ? parsed.props.filter((prop) => prop.key !== "events")
        : [{ key: "type", value: "calendar" }],
    events: getFrontmatterField<string[]>(parsed.props, "events") ?? [],
  };
}

export function serializeCalendar(model: CalendarModel): string {
  return buildContent(
    [
      { key: "type", value: "calendar" },
      { key: "events", value: model.events },
      ...model.frontmatter,
    ],
    "",
  );
}

export function emptyCalendar(): string {
  return serializeCalendar({ frontmatter: [{ key: "type", value: "calendar" }], events: [] });
}
