import type { CommandBus } from "@notes/core";
import type { Tome } from "@notes/tome";
import {
  defaultMessage,
  fileHistory,
  historyStatus,
  snapshot,
  versionDiff,
  type FileHistory,
  type VersionDiff,
} from "./history-store";

interface GetTome {
  (): Tome;
}

/**
 * Registers the `history.*` commands that back the version-history UI. All
 * state lives in a git repository inside the Tome folder (portable, pure-JS via
 * isomorphic-git) so backups are plain git commits the user can push anywhere.
 */
export function registerHistoryCommands(bus: CommandBus, getTome: GetTome): void {
  bus.register<Record<string, never>, { initialized: boolean }>({
    name: "history.status",
    handler: async () => historyStatus(getTome().root),
  });

  bus.register<{ message?: string }, { created: boolean; oid?: string }>({
    name: "history.snapshot",
    mutates: true,
    handler: async ({ message }) => snapshot(getTome().root, message ?? defaultMessage()),
  });

  bus.register<{ path: string }, FileHistory>({
    name: "history.log",
    handler: async ({ path }) => fileHistory(getTome(), path),
  });

  bus.register<{ path: string; oid: string }, VersionDiff>({
    name: "history.diff",
    handler: async ({ path, oid }) => versionDiff(getTome(), path, oid),
  });
}
