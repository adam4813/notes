import {
  buildContent,
  FrontmatterProp,
  getFrontmatterField,
  parseFrontmatter,
} from "@notes/web/src/lib/frontmatter";

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
