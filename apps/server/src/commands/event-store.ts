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

function serializeEvent(event: RichEvent): string {
  const lines: string[] = ["---"];
  lines.push(`title: ${JSON.stringify(event.title)}`);
  lines.push(`date: "${event.date}"`);
  if (event.time) lines.push(`time: "${event.time}"`);
  if (event.duration != null) lines.push(`duration: ${event.duration}`);
  if (event.location) lines.push(`location: ${JSON.stringify(event.location)}`);
  if (event.allDay) lines.push(`allDay: true`);
  lines.push("---");
  if (event.body) lines.push("", event.body);
  return lines.join("\n");
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---(?:\n|$)/;

function parseEventFile(id: string, content: string): RichEvent {
  const fm = FRONTMATTER_RE.exec(content);
  const yaml = fm ? fm[1] : "";
  const body = fm ? content.slice(fm[0].length).trimStart() : content;

  const get = (key: string): string | undefined => {
    const m = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(yaml);
    if (!m) return undefined;
    return m[1].trim().replace(/^["'](.*)["']$/, "$1");
  };

  const durationStr = get("duration");
  const allDayStr = get("allDay");

  return {
    id,
    title: get("title") ?? id,
    date: get("date") ?? "2000-01-01",
    body,
    ...(get("time") ? { time: get("time") } : {}),
    ...(durationStr ? { duration: Number(durationStr) } : {}),
    ...(get("location") ? { location: get("location") } : {}),
    ...(allDayStr === "true" ? { allDay: true } : {}),
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
