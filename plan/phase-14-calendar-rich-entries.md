# Phase 14 — Calendar Rich Entries

**Status:** ✅ Complete
**Depends on:** 13

## Goal

Upgrade calendar events from single-line records to **full notes** using the same dotfolder
pattern established in Phase 13. Each event has typed frontmatter (date, time, duration,
location, recurrence) plus a rich markdown body. The time-picker bug (no time input on new
events) is fixed here.

## Architecture

```
My Calendar.md                       ← event ID list + calendar settings
.My Calendar.events/                 ← hidden dot-folder
  evt-m5x3a1b2.md                    ← full event note
```

**`My Calendar.md` (new format):**
```markdown
---
type: calendar
events: [evt-m5x3a1b2, evt-n7y4c2d3]
---
```

**`evt-m5x3a1b2.md`:**
```markdown
---
title: Kickoff Meeting
date: 2026-07-15
time: "09:30"
duration: 60
location: "Zoom"
allDay: false
---

## Agenda

- Welcome
- Goals for Q3
```

## Tasks

### Task: Extend event model & EventStore  `Wave 1`
- Add `RichEvent` to `packages/note-calendar/src/calendar-format.ts`:
  ```ts
  export interface RichEvent {
    id: string;
    title: string;
    date: string;        // YYYY-MM-DD
    time?: string;       // HH:MM (24h)
    duration?: number;   // minutes (default 60)
    location?: string;
    allDay?: boolean;
    body: string;        // markdown
  }
  ```
- Change `CalendarModel.events` from `CalendarEvent[]` to `string[]` (event IDs).
- Create `packages/note-calendar/src/event-store.ts` (mirrors `card-store.ts`):
  - `dotFolderPath(calendarPath)` → `.CalendarName.events/`
  - `eventPath`, `readEvent`, `writeEvent`, `deleteEvent`, `listEvents`
- Update `parseCalendar` / `serializeCalendar` for new format.

### Task: Auto-migrate old calendar format  `Wave 1`
- Detect old format (`- DATE [TIME] Title` lines).
- Create event files from old lines (title = text, body = "", date/time from line).
- Rewrite calendar file to new format on first save after migration.

### Task: Server commands for event CRUD  `Wave 1`
Create `apps/server/src/commands/event-commands.ts` and register in `routes.ts`:

- `POST /api/events/create` — `{ calendarPath, date }` → create event file, return `RichEvent`
- `POST /api/events/update` — `{ calendarPath, event: RichEvent }` → write event file
- `POST /api/events/delete` — `{ calendarPath, eventId }` → delete file, update calendar
- `GET  /api/events/list`   — `{ calendarPath }` → all events
- `GET  /api/events/get`    — `{ calendarPath, eventId }` → single event

### Task: Update CalendarView for rich entries  `Wave 2`
- Fetch events via `GET /api/events/list?calendarPath=…` on mount.
- Calendar grid (month/week/day) renders event chips by date — unchanged visual.
- Click event chip → opens **event editor panel/modal**:
  - `<input type="date">` for date
  - `<input type="time">` for time (**fixes the missing time-picker bug**)
  - Duration select (15 min / 30 min / 1 h / 2 h / all day / custom)
  - Location text input
  - Full `MarkdownEditor` for body (rendered mode by default)
  - Auto-save on change (debounced 800 ms)
  - Delete button
- "New event" button: date picker (pre-filled with clicked day in grid) → creates event.
- Events with a body show a "has notes" indicator (e.g., a small dot on the chip).

### Task: FTS index event bodies  `Wave 2`
- Extend indexer to walk `.*.events/` dot-folders (same logic as `.*.cards/` from Phase 13).
- `linkable: false` for event files; indexed for FTS.

## Verification Checklist
- [ ] Old calendar entries auto-migrate: line-items become event files
- [ ] Creating an event opens a form with date + time picker
- [ ] Time picker works (proper `<input type="time">`)
- [ ] Event body supports full markdown editing
- [ ] Events appear in the calendar grid on the correct date
- [ ] Deleting an event removes the file and updates the calendar
- [ ] Event content appears in full-text search
- [ ] `.*.events/` folder not shown in explorer
- [ ] `npm run typecheck && npm test` green

## 🛑 GATE
1. Does the event editor feel complete? Are the date/time/duration controls usable?
2. Do migrated events retain their date and title correctly?
3. Any fields missing (recurrence, color coding)?
4. Any blocking issues?

## Git Checkpoint
```
feat: rich calendar entries — dotfolder event files with full markdown body

- RichEvent model + EventStore (mirrors CardStore pattern)
- New calendar format: event ID list; auto-migrate old line-item format
- Server CRUD commands: CreateEvent, UpdateEvent, DeleteEvent
- CalendarView: click event → editor panel with date/time/duration/location/body
- Fixes time-picker (no time input on new events)
- Index: FTS event bodies; exclude from wikilink autocomplete

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Files to stage:
- `packages/note-calendar/src/calendar-format.ts`
- `packages/note-calendar/src/event-store.ts` (new)
- `packages/note-calendar/src/calendar-view.tsx`
- `packages/note-calendar/src/index.ts`
- `apps/server/src/commands/event-commands.ts` (new)
- `apps/server/src/routes.ts`
- `packages/index/src/` (extend dot-folder walker)

## Feedback

**Date:** 2026-07-08
**Result:** ✅ GATE passed

- Event editor UX: **Great**
- Migration: **Preserved existing events**
- Blocking issues: **None**
- No missing fields requested
