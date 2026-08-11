import type { NoteTypeDescriptor } from "@notes/editor";
import { CalendarView } from "./calendar-view";

export const CALENDAR_NOTE_TYPE_ID = "calendar";

/** Calendar notes are `.md` files with `type: calendar` frontmatter. */
export const calendarNoteType: NoteTypeDescriptor = {
  id: CALENDAR_NOTE_TYPE_ID,
  detect(file) {
    return file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "calendar";
  },
  supportedModes: ["rendered"],
  sourceProtected: true,
  supportsScrollSync: false,
  viewComponent: CalendarView,
};
