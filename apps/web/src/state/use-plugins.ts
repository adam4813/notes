import {
  PluginManager,
  Signal,
  type ActiveDocument,
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
  list: PluginInfo[];
  isEnabled: (id: string) => boolean;
  toggle: (id: string, enabled: boolean) => void;
}

export function usePlugins(): PluginsApi {
  const documentSignal = useMemo(() => new Signal<ActiveDocument | null>(null), []);
  const [pluginCommands, setPluginCommands] = useState<PluginCommand[]>([]);
  const [statusItems, setStatusItems] = useState<StatusBarItem[]>([]);
  const [list, setList] = useState<PluginInfo[]>([]);
  const managerRef = useRef<PluginManager>();

  useEffect(() => {
    let manager: PluginManager | undefined;
    let disposed = false;
    const host: PluginHost = {
      registerCommand: (command) => {
        // Dedupe by id so a double-registration (e.g. React StrictMode) can't
        // surface the same command twice in the palette.
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
      document: documentSignal,
      storage: window.localStorage,
    };

    void (async () => {
      // Scope the enabled set per Tome so each Tome remembers its own plugins.
      let scope = "default";
      try {
        scope = (await api.tome()).id;
      } catch {
        scope = "default";
      }
      if (disposed) {
        return;
      }
      manager = new PluginManager(host, `notes.plugins.enabled:${scope}`);
      managerRef.current = manager;
      for (const plugin of localPlugins) {
        manager.register(plugin);
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
    };
  }, [documentSignal]);

  const toggle = useCallback((id: string, enabled: boolean) => {
    const manager = managerRef.current;
    if (!manager) {
      return;
    }
    const done = enabled ? manager.enable(id) : Promise.resolve(manager.disable(id));
    void Promise.resolve(done).then(() => setList(manager.list()));
  }, []);

  const isEnabled = useCallback((id: string) => managerRef.current?.isEnabled(id) ?? false, []);

  return { documentSignal, pluginCommands, statusItems, list, isEnabled, toggle };
}
