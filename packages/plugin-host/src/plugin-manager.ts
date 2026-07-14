import type { Disposer, NotesPlugin, PluginContext, PluginHost, PluginSettings } from "./context";
import { validateManifest, type PluginManifest } from "./manifest";

const ENABLED_KEY = "notes.plugins.enabled";

interface Entry {
  plugin: NotesPlugin;
  manifest: PluginManifest;
  enabled: boolean;
  disposers: Disposer[];
}

export interface PluginInfo {
  manifest: PluginManifest;
  enabled: boolean;
  error?: string;
}

/**
 * Owns the plugin catalog and lifecycle. Activation collects every contribution
 * disposer so `disable` unregisters cleanly with no leaks. Load/activate errors
 * are captured per-plugin and never crash the host.
 */
export class PluginManager {
  private readonly entries = new Map<string, Entry>();
  private readonly errors = new Map<string, string>();

  constructor(
    private readonly host: PluginHost,
    /** localStorage key for the persisted enabled set (per-Tome scoping). */
    private readonly enabledKey: string = ENABLED_KEY,
  ) {}

  private readEnabledSet(): Set<string> {
    try {
      const raw = this.host.storage.getItem(this.enabledKey);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  }

  private writeEnabledSet(ids: Set<string>): void {
    this.host.storage.setItem(this.enabledKey, JSON.stringify([...ids]));
  }

  /** Registers a plugin in the catalog (does not activate it). */
  register(plugin: NotesPlugin): boolean {
    const validation = validateManifest(plugin.manifest);
    if (!validation.ok || !validation.manifest) {
      this.errors.set(plugin.manifest?.id ?? "unknown", validation.error ?? "invalid manifest");
      return false;
    }
    const manifest = validation.manifest;
    if (this.entries.has(manifest.id)) {
      return false;
    }
    this.entries.set(manifest.id, { plugin, manifest, enabled: false, disposers: [] });
    return true;
  }

  list(): PluginInfo[] {
    return [...this.entries.values()].map((entry) => ({
      manifest: entry.manifest,
      enabled: entry.enabled,
      error: this.errors.get(entry.manifest.id),
    }));
  }

  isEnabled(id: string): boolean {
    return this.entries.get(id)?.enabled ?? false;
  }

  private buildContext(entry: Entry): PluginContext {
    const settings: PluginSettings = {
      get: <T>(key: string, fallback: T): T => {
        try {
          const raw = this.host.storage.getItem(`notes.plugin.${entry.manifest.id}.${key}`);
          return raw === null ? fallback : (JSON.parse(raw) as T);
        } catch {
          return fallback;
        }
      },
      set: (key: string, value: unknown) => {
        this.host.storage.setItem(
          `notes.plugin.${entry.manifest.id}.${key}`,
          JSON.stringify(value),
        );
      },
    };

    return {
      manifest: entry.manifest,
      registerCommand: (command) => {
        const disposer = this.host.registerCommand(command);
        entry.disposers.push(disposer);
        return disposer;
      },
      addStatusBarItem: (item) => {
        const disposer = this.host.addStatusBarItem(item);
        entry.disposers.push(disposer);
        return disposer;
      },
      setThemeToken: (name, value) => {
        const disposer = this.host.setThemeToken(name, value);
        entry.disposers.push(disposer);
        return disposer;
      },
      document: this.host.document,
      settings,
    };
  }

  async enable(id: string, persist = true): Promise<boolean> {
    const entry = this.entries.get(id);
    if (!entry || entry.enabled) {
      return false;
    }
    try {
      await entry.plugin.activate(this.buildContext(entry));
      entry.enabled = true;
      this.errors.delete(id);
      if (persist) {
        const ids = this.readEnabledSet();
        ids.add(id);
        this.writeEnabledSet(ids);
      }
      return true;
    } catch (error) {
      this.errors.set(id, error instanceof Error ? error.message : String(error));
      this.teardown(entry);
      return false;
    }
  }

  disable(id: string, persist = true): boolean {
    const entry = this.entries.get(id);
    if (!entry || !entry.enabled) {
      return false;
    }
    try {
      entry.plugin.deactivate?.();
    } catch (error) {
      this.errors.set(id, error instanceof Error ? error.message : String(error));
    }
    this.teardown(entry);
    entry.enabled = false;
    if (persist) {
      const ids = this.readEnabledSet();
      ids.delete(id);
      this.writeEnabledSet(ids);
    }
    return true;
  }

  private teardown(entry: Entry): void {
    for (const disposer of entry.disposers.splice(0).reverse()) {
      try {
        disposer();
      } catch {
        // ignore disposer errors
      }
    }
  }

  /** Enables every plugin previously persisted as enabled. */
  async activateEnabled(): Promise<void> {
    const enabled = this.readEnabledSet();
    for (const id of this.entries.keys()) {
      if (enabled.has(id)) {
        await this.enable(id, false);
      }
    }
  }
}
