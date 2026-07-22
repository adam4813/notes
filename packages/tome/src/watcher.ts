import { relative, sep } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import type { EventBus } from "@notes/core";

export type TomeChangeKind = "created" | "modified" | "deleted";

export interface TomeChange {
  kind: TomeChangeKind;
  /** Root-relative, POSIX-separated path. */
  path: string;
}

export interface TomeEventMap extends Record<string, unknown> {
  "tome:change": TomeChange;
}

/** Maps a chokidar event name to a normalized change kind (or undefined to ignore). */
export function chokidarEventToKind(event: string): TomeChangeKind | undefined {
  switch (event) {
    case "add":
      return "created";
    case "change":
      return "modified";
    case "unlink":
      return "deleted";
    default:
      return undefined;
  }
}

function isIgnored(path: string): boolean {
  const base = path.split(/[\\/]/).pop() ?? "";
  return base.startsWith(".") || base === "node_modules";
}

/** Watches a Tome and emits normalized `tome:change` events on the event bus. */
export class TomeWatcher {
  private watcher?: FSWatcher;

  constructor(
    private readonly root: string,
    private readonly bus: EventBus<TomeEventMap>,
  ) {}

  start(): void {
    this.watcher = chokidar.watch(this.root, {
      ignoreInitial: true,
      ignored: (path: string) => isIgnored(path),
    });

    this.watcher.on("all", (event: string, absolutePath: string) => {
      const kind = chokidarEventToKind(event);
      if (!kind) {
        return;
      }
      const path = relative(this.root, absolutePath).split(sep).join("/");
      void this.bus.emit("tome:change", { kind, path });
    });
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
    this.watcher = undefined;
  }
}
