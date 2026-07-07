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
    const host: PluginHost = {
      registerCommand: (command) => {
        setPluginCommands((prev) => [...prev, command]);
        return () => setPluginCommands((prev) => prev.filter((c) => c.id !== command.id));
      },
      addStatusBarItem: (item) => {
        setStatusItems((prev) => [...prev, item]);
        return () => setStatusItems((prev) => prev.filter((i) => i.id !== item.id));
      },
      setThemeToken: (name, value) => {
        document.documentElement.style.setProperty(name, value);
        return () => document.documentElement.style.removeProperty(name);
      },
      document: documentSignal,
      storage: window.localStorage,
    };

    const manager = new PluginManager(host);
    managerRef.current = manager;
    for (const plugin of localPlugins) {
      manager.register(plugin);
    }
    void manager.activateEnabled().then(() => setList(manager.list()));
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
