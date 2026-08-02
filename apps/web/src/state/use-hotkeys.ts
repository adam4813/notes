import {
  findConflicts,
  resolveCommand,
  type HotkeyBinding,
  type KeyChord,
  type Platform,
} from "@notes/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppCommand } from "./commands";

const OVERRIDE_KEY = "notes.hotkeys";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") {
    return "other";
  }
  const source = `${navigator.platform ?? ""} ${navigator.userAgent}`;
  return /mac|iphone|ipad/i.test(source) ? "mac" : "other";
}

function loadOverrides(): Record<string, string> {
  try {
    const raw = globalThis.localStorage?.getItem(OVERRIDE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, string>;
    }
  } catch {
    // ignore malformed persisted overrides
  }
  return {};
}

function saveOverrides(overrides: Record<string, string>): void {
  globalThis.localStorage?.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
}

export interface HotkeysApi {
  platform: Platform;
  bindings: HotkeyBinding[];
  /** The effective (override-or-default) combo for a command, if any. */
  comboFor: (commandId: string) => string | undefined;
  /** True when the command's combo has been customized by the user. */
  isCustom: (commandId: string) => boolean;
  rebind: (commandId: string, combo: string) => void;
  reset: (commandId: string) => void;
  conflicts: Record<string, string[]>;
}

/**
 * Installs a global keydown listener that maps key presses to commands and
 * exposes rebind/reset/conflict data (persisted as user overrides).
 */
export function useHotkeys(commands: AppCommand[]): HotkeysApi {
  const platform = useMemo(() => detectPlatform(), []);
  const [overrides, setOverrides] = useState<Record<string, string>>(loadOverrides);

  const comboFor = useCallback(
    (commandId: string): string | undefined => {
      if (commandId in overrides) {
        return overrides[commandId] || undefined;
      }
      return commands.find((command) => command.id === commandId)?.defaultHotkey;
    },
    [overrides, commands],
  );

  const bindings = useMemo<HotkeyBinding[]>(
    () =>
      commands
        .map((command) => ({ commandId: command.id, combo: comboFor(command.id) }))
        .filter((binding): binding is HotkeyBinding => Boolean(binding.combo)),
    [commands, comboFor],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const chord: KeyChord = {
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        alt: event.altKey,
        shift: event.shiftKey,
        key: event.key,
      };
      const commandId = resolveCommand(bindings, chord, platform);
      if (!commandId) {
        return;
      }
      // Don't hijack plain typing inside editable fields; require a modifier there.
      const target = event.target as HTMLElement | null;
      const editable = Boolean(
        target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName)),
      );
      const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
      if (editable && !hasModifier) {
        return;
      }
      const command = commands.find((candidate) => candidate.id === commandId);
      if (command) {
        event.preventDefault();
        command.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [platform, commands, bindings]);

  const rebind = useCallback((commandId: string, combo: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [commandId]: combo };
      saveOverrides(next);
      return next;
    });
  }, []);

  const reset = useCallback((commandId: string) => {
    setOverrides((prev) => {
      if (!(commandId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[commandId];
      saveOverrides(next);
      return next;
    });
  }, []);

  const isCustom = useCallback((commandId: string) => commandId in overrides, [overrides]);

  const conflicts = useMemo(() => findConflicts(bindings, platform), [bindings, platform]);

  return { platform, bindings, comboFor, isCustom, rebind, reset, conflicts };
}
