import {
  buildContent,
  getFrontmatterField,
  parseFrontmatter,
} from "@notes/web/src/lib/frontmatter";
import { basename } from "node:path";
import { readdir } from "node:fs/promises";
import { posix } from "node:path";
import type { Tome } from "@notes/tome";
import type { RichEvent } from "@notes/note-calendar";

/** Returns the dot-folder path for a calendar's event files (relative to tome root). */
export function eventDotFolder(calendarPath: string): string {
  const dir = posix.dirname(calendarPath);
  const base = posix.basename(calendarPath, ".md");
  const folder = `.${base}.events`;
  return dir === "." ? folder : `${dir}/${folder}`;
}

export function eventFilePath(calendarPath: string, eventId: string): string {
  return `${eventDotFolder(calendarPath)}/${eventId}.md`;
}

const keyFields: (keyof RichEvent)[] = ["title", "date", "time", "duration", "location", "allDay"];

function serializeEvent(event: RichEvent): string {
  return buildContent(
    [...keyFields.map((key) => ({ key, value: event[key] })), ...(event.frontmatter ?? [])].filter(
      Boolean,
    ),
    event.body,
  );
}

function parseEventFile(id: string, content: string): RichEvent {
  const parsed = parseFrontmatter(content);

  const durationStr = getFrontmatterField(parsed.props, "duration");
  const timeStr = getFrontmatterField(parsed.props, "time");
  const locationStr = getFrontmatterField(parsed.props, "location");

  return {
    id,
    title: getFrontmatterField(parsed.props, "title") ?? id,
    date: getFrontmatterField(parsed.props, "date") ?? "2000-01-01",
    ...(timeStr ? { time: timeStr } : {}),
    ...(durationStr ? { duration: Number(durationStr) } : {}),
    ...(locationStr ? { location: locationStr } : {}),
    ...(getFrontmatterField(parsed.props, "allDay") === "true" ? { allDay: true } : {}),
    body: parsed.body,
    frontmatter: parsed.props.filter((prop) => !keyFields.includes(prop.key as keyof RichEvent)),
  };
}

export async function readEvent(
  calendarPath: string,
  eventId: string,
  tome: Tome,
): Promise<RichEvent> {
  const content = await tome.read(eventFilePath(calendarPath, eventId));
  return parseEventFile(eventId, content);
}

export async function writeEvent(
  calendarPath: string,
  event: RichEvent,
  tome: Tome,
): Promise<void> {
  const folder = eventDotFolder(calendarPath);
  await tome.mkdir(folder);
  await tome.write(eventFilePath(calendarPath, event.id), serializeEvent(event));
}

export async function deleteEvent(
  calendarPath: string,
  eventId: string,
  tome: Tome,
): Promise<void> {
  const filePath = eventFilePath(calendarPath, eventId);
  if (await tome.exists(filePath)) {
    await tome.delete(filePath);
  }
}

export async function listEvents(calendarPath: string, tome: Tome): Promise<RichEvent[]> {
  const folder = eventDotFolder(calendarPath);
  if (!(await tome.exists(folder))) return [];
  let entries: string[];
  try {
    entries = await readdir(tome.resolve(folder));
  } catch {
    return [];
  }
  const events: RichEvent[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const id = basename(entry, ".md");
    try {
      events.push(await readEvent(calendarPath, id, tome));
    } catch {
      // Skip unreadable event files
    }
  }
  return events;
}
