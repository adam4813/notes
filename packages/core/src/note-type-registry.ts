import type { NoteFileDescriptor, NoteTypeDetector } from "./contracts";
import { Registry } from "./registry";

/**
 * Registry for note types.
 *
 * The generic parameter T lets server code work with the minimal NoteTypeDetector
 * while client code uses the full NoteTypeDescriptor (from packages/editor).
 * Both share this class; the server simply ignores the extra view fields.
 *
 * A single entry may be marked as the fallback (matched last).
 */
export class NoteTypeRegistry<T extends NoteTypeDetector = NoteTypeDetector> {
  private readonly providers = new Registry<T>();
  private fallbackId?: string;

  /**
   * Registers a note-type descriptor. Returns a disposer that unregisters it;
   * callers that do not need to unregister may ignore the return value.
   */
  register(descriptor: T, options?: { fallback?: boolean }): () => void {
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

  get(id: string): T | undefined {
    return this.providers.get(id);
  }

  list(): T[] {
    return this.providers.list();
  }

  detect(file: NoteFileDescriptor): T | undefined {
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
