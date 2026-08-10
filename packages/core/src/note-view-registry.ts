import type { NoteTypeProvider } from "./contracts";
import { Registry } from "./registry";

export type NoteViewDisposer = () => void;

/**
 * Runtime registry that maps note-type IDs to their full NoteTypeProvider
 * (including optional UI capability fields). Built-in note types call
 * `register` at startup; plugins call `PluginContext.registerNoteView`.
 *
 * This is separate from NoteTypeRegistry (which is server/detection-focused)
 * so the client-side view layer can be populated independently.
 */
export class NoteViewRegistry {
  private readonly providers = new Registry<NoteTypeProvider>();

  /**
   * Registers a note-type provider and returns a disposer that unregisters it.
   */
  register(provider: NoteTypeProvider): NoteViewDisposer {
    this.providers.register(provider.id, provider);
    return () => {
      this.providers.unregister(provider.id);
    };
  }

  get(id: string): NoteTypeProvider | undefined {
    return this.providers.get(id);
  }

  list(): NoteTypeProvider[] {
    return this.providers.list();
  }
}
