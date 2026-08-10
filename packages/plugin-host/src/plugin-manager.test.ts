import { describe, expect, it, vi } from "vitest";
import type {
  FileTypeHandler,
  NotesPlugin,
  PluginCommand,
  PluginHost,
  StatusBarItem,
} from "./context";
import { Signal } from "./signal";
import { PluginManager } from "./plugin-manager";

function makeHost() {
  const commands = new Map<string, PluginCommand>();
  const statusItems = new Map<string, StatusBarItem>();
  const tokens = new Map<string, string>();
  const fileHandlers: FileTypeHandler[] = [];
  const store = new Map<string, string>();
  const host: PluginHost = {
    registerCommand: (command) => {
      commands.set(command.id, command);
      return () => commands.delete(command.id);
    },
    addStatusBarItem: (item) => {
      statusItems.set(item.id, item);
      return () => statusItems.delete(item.id);
    },
    setThemeToken: (name, value) => {
      tokens.set(name, value);
      return () => tokens.delete(name);
    },
    registerFileHandler: (handler) => {
      fileHandlers.push(handler);
      return () => fileHandlers.splice(fileHandlers.indexOf(handler), 1);
    },
    registerNoteView: (_descriptor) => {
      return () => {};
    },
    document: new Signal(null),
    storage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    },
  };
  return { host, commands, statusItems, tokens, fileHandlers, store };
}

function samplePlugin(overrides: Partial<NotesPlugin> = {}): NotesPlugin {
  return {
    manifest: {
      id: "sample",
      name: "Sample",
      version: "1.0.0",
      entry: { client: true },
      permissions: [],
    },
    activate: (ctx) => {
      ctx.registerCommand({ id: "sample.hello", label: "Hello", run: () => {} });
      ctx.addStatusBarItem({ id: "sample.item", mount: () => () => {} });
    },
    ...overrides,
  };
}

describe("PluginManager", () => {
  it("registers valid plugins and rejects invalid manifests", () => {
    const { host } = makeHost();
    const manager = new PluginManager(host);
    expect(manager.register(samplePlugin())).toBe(true);
    expect(
      manager.register({
        manifest: { id: "Bad Id!" } as never,
        activate: () => {},
      }),
    ).toBe(false);
  });

  it("enable activates contributions; disable tears them down cleanly", async () => {
    const { host, commands, statusItems } = makeHost();
    const manager = new PluginManager(host);
    manager.register(samplePlugin());

    await manager.enable("sample");
    expect(manager.isEnabled("sample")).toBe(true);
    expect(commands.has("sample.hello")).toBe(true);
    expect(statusItems.has("sample.item")).toBe(true);

    manager.disable("sample");
    expect(manager.isEnabled("sample")).toBe(false);
    expect(commands.size).toBe(0);
    expect(statusItems.size).toBe(0);
  });

  it("calls deactivate on disable", async () => {
    const { host } = makeHost();
    const deactivate = vi.fn();
    const manager = new PluginManager(host);
    manager.register(samplePlugin({ deactivate }));
    await manager.enable("sample");
    manager.disable("sample");
    expect(deactivate).toHaveBeenCalledOnce();
  });

  it("captures activation errors without throwing and records them", async () => {
    const { host, commands } = makeHost();
    const manager = new PluginManager(host);
    manager.register(
      samplePlugin({
        activate: (ctx) => {
          ctx.registerCommand({ id: "boom.cmd", label: "Boom", run: () => {} });
          throw new Error("activate failed");
        },
      }),
    );

    await expect(manager.enable("sample")).resolves.toBe(false);
    expect(manager.isEnabled("sample")).toBe(false);
    // Partial contributions are rolled back.
    expect(commands.size).toBe(0);
    expect(manager.list()[0].error).toContain("activate failed");
  });

  it("registers and tears down theme-token contributions", async () => {
    const { host, tokens } = makeHost();
    const manager = new PluginManager(host);
    manager.register(
      samplePlugin({
        activate: (ctx) => {
          ctx.setThemeToken("--accent", "#123456");
        },
      }),
    );
    await manager.enable("sample");
    expect(tokens.get("--accent")).toBe("#123456");
    manager.disable("sample");
    expect(tokens.has("--accent")).toBe(false);
  });

  it("persists the enabled set under a per-Tome key", async () => {
    const shared = makeHost();
    const manager = new PluginManager(shared.host, "notes.plugins.enabled:tomeA");
    manager.register(samplePlugin());
    await manager.enable("sample");
    expect(shared.store.get("notes.plugins.enabled:tomeA")).toContain("sample");
    expect(shared.store.get("notes.plugins.enabled")).toBeUndefined();

    // A manager for a different Tome starts with nothing enabled.
    const other = new PluginManager(shared.host, "notes.plugins.enabled:tomeB");
    other.register(samplePlugin());
    await other.activateEnabled();
    expect(other.isEnabled("sample")).toBe(false);
  });

  it("persists enabled state and re-activates it", async () => {
    const first = makeHost();
    const manager1 = new PluginManager(first.host);
    manager1.register(samplePlugin());
    await manager1.enable("sample");

    // A fresh manager sharing the same storage re-activates persisted plugins.
    const manager2 = new PluginManager(first.host);
    manager2.register(samplePlugin());
    await manager2.activateEnabled();
    expect(manager2.isEnabled("sample")).toBe(true);
  });
});
