import type { NoteFileDescriptor, NoteTypeProvider } from "./contracts";
import { Registry } from "./registry";

/**
 * Factory/registry that resolves a file to its note-type provider. Providers
 * are checked in registration order; a single provider may be marked as the
 * fallback (matched last), which the default markdown provider uses.
 */
export class NoteTypeRegistry {
  private readonly providers = new Registry<NoteTypeProvider>();
  private fallbackId?: string;

  register(provider: NoteTypeProvider, options?: { fallback?: boolean }): void {
    this.providers.register(provider.id, provider);
    if (options?.fallback) {
      this.fallbackId = provider.id;
    }
  }

  unregister(id: string): boolean {
    if (this.fallbackId === id) {
      this.fallbackId = undefined;
    }
    return this.providers.unregister(id);
  }

  get(id: string): NoteTypeProvider | undefined {
    return this.providers.get(id);
  }

  list(): NoteTypeProvider[] {
    return this.providers.list();
  }

  detect(file: NoteFileDescriptor): NoteTypeProvider | undefined {
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
