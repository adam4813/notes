import type { NoteTypeProvider, NoteViewRegistry, NoteViewDisposer } from "@notes/core";
import { CalendarView } from "./calendar-view";

export const CALENDAR_NOTE_TYPE_ID = "calendar";

/** Calendar notes are `.md` files with `type: calendar` frontmatter. */
export const calendarNoteType: NoteTypeProvider = {
  id: CALENDAR_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "calendar";
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: CalendarView,
};

/** Registers the calendar note type with the NoteViewRegistry — mirrors the plugin pattern. */
export function registerBuiltinNoteView(registry: NoteViewRegistry): NoteViewDisposer {
  return registry.register(calendarNoteType);
}
