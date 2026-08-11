import type { NoteTypeRegistry } from "@notes/core";
import type { NoteTypeViewDescriptor } from "@notes/editor";
import { CalendarView } from "./calendar-view";

export const CALENDAR_NOTE_TYPE_ID = "calendar";

/** Calendar notes are `.md` files with `type: calendar` frontmatter. */
export const calendarNoteType: NoteTypeViewDescriptor = {
  id: CALENDAR_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "calendar";
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: CalendarView,
};

/** Registers the calendar note type with the NoteTypeRegistry — mirrors the plugin pattern. */
export function registerBuiltinNoteType(registry: NoteTypeRegistry): () => void {
  return registry.register(calendarNoteType);
}
