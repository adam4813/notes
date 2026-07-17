import { markdownNoteType, NoteTypeRegistry, type CommandBus } from "@notes/core";
import { boardNoteType } from "@notes/note-boards";
import { calendarNoteType } from "@notes/note-calendar";
import { canvasNoteType } from "@notes/note-canvas";
import { gridNoteType } from "@notes/note-grid";
import { mermaidNoteType } from "@notes/note-mermaid";
import { tableNoteType } from "@notes/note-tables";
import type { Tome } from "@notes/tome";
import { frontmatterType } from "@notes/web/src/lib/frontmatter";

/**
 * Registers note-type providers (markdown fallback + first-party table) on a
 * NoteTypeRegistry and exposes a `note.detectType` command. This is the seam the
 * plugin system (Phase 9) will register third-party note types through.
 */
export function registerNoteTypeCommands(bus: CommandBus, getTome: () => Tome): void {
  const registry = new NoteTypeRegistry();
  registry.register(markdownNoteType, { fallback: true });
  registry.register(tableNoteType);
  registry.register(canvasNoteType);
  registry.register(boardNoteType);
  registry.register(mermaidNoteType);
  registry.register(calendarNoteType);
  registry.register(gridNoteType);

  bus.register<{ path: string }, { type: string | null }>({
    name: "note.detectType",
    handler: async (payload) => {
      let detected: string | undefined;
      try {
        detected = frontmatterType(await getTome().read(payload.path));
      } catch {
        detected = undefined;
      }
      const provider = registry.detect({ path: payload.path, frontmatterType: detected });
      return { type: provider?.id ?? null };
    },
  });
}
