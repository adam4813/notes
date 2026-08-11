import type { NoteFileDescriptor, NoteTypeDescriptor } from "./contracts";
import { Registry } from "./registry";

/**
 * Unified registry for note types — stores the full NoteTypeDescriptor
 * for every registered note type.
 *
 * - Detection (`detect`) is used server-side to match a file to its type.
 * - View capabilities (`viewComponent`, `supportedModes`, …) are used
 *   client-side; the optional fields are simply absent in server-only usage.
 *
 * A single provider may be marked as the fallback (matched last).
 */
export class NoteTypeRegistry {
  private readonly providers = new Registry<NoteTypeDescriptor>();
  private fallbackId?: string;

  /**
   * Registers a note-type descriptor. Returns a disposer that unregisters it;
   * callers that do not need to unregister may ignore the return value.
   */
  register(descriptor: NoteTypeDescriptor, options?: { fallback?: boolean }): () => void {
    this.providers.register(descriptor.id, descriptor);
    if (options?.fallback) {
      this.fallbackId = descriptor.id;
    }
    return () => {
      if (this.fallbackId === descriptor.id) {
        this.fallbackId = undefined;
      }
      this.providers.unregister(descriptor.id);
    };
  }

  get(id: string): NoteTypeDescriptor | undefined {
    return this.providers.get(id);
  }

  list(): NoteTypeDescriptor[] {
    return this.providers.list();
  }

  detect(file: NoteFileDescriptor): NoteTypeDescriptor | undefined {
    for (const provider of this.providers.list()) {
      if (provider.id === this.fallbackId) {
        continue;
      }
      if (provider.detect(file)) {
        return provider;
      }
    }

    if (this.fallbackId) {
      const fallback = this.providers.get(this.fallbackId);
      if (fallback?.detect(file)) {
        return fallback;
      }
    }

    return undefined;
  }
}
