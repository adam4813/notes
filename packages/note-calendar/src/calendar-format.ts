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
}

export interface CalendarModel {
  /** Ordered list of event IDs. */
  events: string[];
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
/** Old line-item format: `- DATE [TIME] Title` */
const OLD_EVENT_RE = /^\s*-\s+(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?\s+(.+)$/;

let counter = 0;
export function newEventId(): string {
  counter += 1;
  return `evt-${Date.now().toString(36)}-${counter}`;
}

function serializeCalendarFrontmatter(model: CalendarModel): string {
  const lines = ["type: calendar"];
  if (model.events.length === 0) {
    lines.push("events: []");
  } else {
    lines.push("events:");
    for (const id of model.events) {
      lines.push(`  - ${id}`);
    }
  }
  return lines.join("\n");
}

function parseCalendarFrontmatter(yaml: string): CalendarModel | null {
  if (!yaml.includes("events:")) return null;
  const inlineMatch = /^events:\s*\[([^\]]*)\]/m.exec(yaml);
  if (inlineMatch) {
    const events = inlineMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return { events };
  }
  // Multi-line events list
  const events: string[] = [];
  let inList = false;
  for (const raw of yaml.split("\n")) {
    const line = raw.trimEnd();
    if (/^events:\s*$/.test(line)) {
      inList = true;
      continue;
    }
    if (inList) {
      const idMatch = /^  - (.+)$/.exec(line);
      if (idMatch) {
        events.push(idMatch[1].trim());
      } else if (line && /^[a-z]/.test(line)) {
        inList = false;
      }
    }
  }
  return { events };
}

/**
 * Parses a calendar file. If the file used the old line-item format,
 * `migratedEvents` is populated with stub RichEvents for the server to persist.
 */
export function parseCalendar(markdown: string): {
  model: CalendarModel;
  migratedEvents?: RichEvent[];
} {
  const fm = FRONTMATTER_RE.exec(markdown);
  const yamlText = fm ? fm[1] : "";
  const body = fm ? markdown.slice(fm[0].length) : markdown;

  const newModel = parseCalendarFrontmatter(yamlText);
  if (newModel) {
    return { model: newModel };
  }

  // Old format: line-item events → migrate
  const events: string[] = [];
  const migratedEvents: RichEvent[] = [];
  for (const line of body.split(/\r?\n/)) {
    const match = OLD_EVENT_RE.exec(line);
    if (match) {
      const title = match[3].trim();
      if (!title) continue;
      const id = newEventId();
      events.push(id);
      migratedEvents.push({
        id,
        title,
        date: match[1],
        body: "",
        ...(match[2] ? { time: match[2] } : {}),
      });
    }
  }

  return {
    model: { events },
    ...(migratedEvents.length > 0 ? { migratedEvents } : {}),
  };
}

export function serializeCalendar(model: CalendarModel): string {
  return `---\n${serializeCalendarFrontmatter(model)}\n---\n`;
}

export function emptyCalendar(): string {
  return serializeCalendar({ events: [] });
}
