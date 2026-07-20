import {
  PluginManager,
  Signal,
  type ActiveDocument,
  type FileTypeHandler,
  type NotesPlugin,
  type PluginCommand,
  type PluginHost,
  type PluginInfo,
  type StatusBarItem,
} from "@notes/plugin-host";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { localPlugins } from "../plugins";

export interface PluginsApi {
  documentSignal: Signal<ActiveDocument | null>;
  pluginCommands: PluginCommand[];
  statusItems: StatusBarItem[];
  fileHandlers: FileTypeHandler[];
  list: PluginInfo[];
  isEnabled: (id: string) => boolean;
  toggle: (id: string, enabled: boolean) => void;
  tomePluginsPath: string;
}

/** Dynamically loads a Tome-installed plugin from the server. Returns null on any failure. */
async function loadTomePlugin(id: string): Promise<NotesPlugin | null> {
  try {
    const scriptText = await api.pluginScript(id);
    const blob = new Blob([scriptText], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    try {
      // @vite-ignore — intentional dynamic import of a user-provided blob URL.
      const mod = await import(/* @vite-ignore */ url);
      const plugin =
        (mod.default as NotesPlugin | undefined) ??
        (Object.values(mod).find(
          (v) => v !== null && typeof v === "object" && "manifest" in (v as object),
        ) as NotesPlugin | undefined);
      return plugin ?? null;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

export function usePlugins(): PluginsApi {
  const documentSignal = useMemo(() => new Signal<ActiveDocument | null>(null), []);
  const [pluginCommands, setPluginCommands] = useState<PluginCommand[]>([]);
  const [statusItems, setStatusItems] = useState<StatusBarItem[]>([]);
  const [fileHandlers, setFileHandlers] = useState<FileTypeHandler[]>([]);
  const [list, setList] = useState<PluginInfo[]>([]);
  const [tomePluginsPath, setTomePluginsPath] = useState("");
  const managerRef = useRef<PluginManager>(undefined);

  useEffect(() => {
    let manager: PluginManager | undefined;
    let disposed = false;
    const host: PluginHost = {
      registerCommand: (command) => {
        setPluginCommands((prev) => [...prev.filter((c) => c.id !== command.id), command]);
        return () => setPluginCommands((prev) => prev.filter((c) => c.id !== command.id));
      },
      addStatusBarItem: (item) => {
        setStatusItems((prev) => [...prev.filter((i) => i.id !== item.id), item]);
        return () => setStatusItems((prev) => prev.filter((i) => i.id !== item.id));
      },
      setThemeToken: (name, value) => {
        document.documentElement.style.setProperty(name, value);
        return () => document.documentElement.style.removeProperty(name);
      },
      registerFileHandler: (handler) => {
        setFileHandlers((prev) => {
          const filtered = prev.filter(
            (h) => !h.extensions.some((ext) => handler.extensions.includes(ext)),
          );
          return [...filtered, handler];
        });
        return () => setFileHandlers((prev) => prev.filter((h) => h !== handler));
      },
      document: documentSignal,
      storage: window.localStorage,
    };

    void (async () => {
      let scope = "default";
      try {
        scope = (await api.tome()).id;
      } catch {
        scope = "default";
      }
      if (disposed) return;

      // Load Tome plugin manifests and path.
      let tomeManifestIds: string[] = [];
      try {
        const { plugins, pluginsPath } = await api.plugins();
        tomeManifestIds = plugins.map((m) => m.id);
        if (!disposed) setTomePluginsPath(pluginsPath);
      } catch {
        // Server may not support plugins yet — ignore.
      }
      if (disposed) return;

      manager = new PluginManager(host, `notes.plugins.enabled:${scope}`);
      managerRef.current = manager;

      for (const plugin of localPlugins) {
        manager.register(plugin);
      }

      // Dynamically load Tome-installed plugins.
      for (const id of tomeManifestIds) {
        if (disposed) break;
        const plugin = await loadTomePlugin(id);
        if (plugin) manager.register(plugin);
      }

      await manager.activateEnabled();
      if (!disposed) {
        setList(manager.list());
      }
    })();

    return () => {
      disposed = true;
      if (manager) {
        for (const info of manager.list()) {
          if (info.enabled) {
            manager.disable(info.manifest.id, false);
          }
        }
      }
      managerRef.current = undefined;
      setPluginCommands([]);
      setStatusItems([]);
      setFileHandlers([]);
    };
  }, [documentSignal]);

  const toggle = useCallback((id: string, enabled: boolean) => {
    const manager = managerRef.current;
    if (!manager) return;
    const done = enabled ? manager.enable(id) : Promise.resolve(manager.disable(id));
    void Promise.resolve(done).then(() => setList(manager.list()));
  }, []);

  const isEnabled = useCallback((id: string) => managerRef.current?.isEnabled(id) ?? false, []);

  return {
    documentSignal,
    pluginCommands,
    statusItems,
    fileHandlers,
    list,
    isEnabled,
    toggle,
    tomePluginsPath,
  };
}
