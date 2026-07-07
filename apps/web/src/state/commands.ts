/** A user-invocable command surfaced in the palette and hotkey system. */
export interface AppCommand {
  id: string;
  title: string;
  /** Grouping label, e.g. "Create", "View", "Theme". */
  category?: string;
  /** Optional leading glyph shown in the palette. */
  icon?: string;
  /** Authored default hotkey combo, e.g. "Mod+P". User overrides win. */
  defaultHotkey?: string;
  run: () => void;
}

const RECENT_KEY = "notes.commands.recent";
const RECENT_LIMIT = 8;

/** Reads the recently-run command ids, most-recent first. */
export function loadRecentCommands(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Records a command as most-recently-run and returns the updated list. */
export function pushRecentCommand(id: string, current: string[]): string[] {
  const next = [id, ...current.filter((existing) => existing !== id)].slice(0, RECENT_LIMIT);
  globalThis.localStorage?.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}
