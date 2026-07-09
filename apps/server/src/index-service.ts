import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { EventBus } from "@notes/core";
import { NoteIndex, type IndexInputFile } from "@notes/index";
import type { Tome, TomeChange, TomeEntry, TomeEventMap } from "@notes/tome";

function flattenFiles(entries: TomeEntry[]): string[] {
  const paths: string[] = [];
  const walk = (list: TomeEntry[]): void => {
    for (const entry of list) {
      if (entry.type === "directory") {
        walk(entry.children ?? []);
      } else {
        paths.push(entry.path);
      }
    }
  };
  walk(entries);
  return paths;
}

function isIndexable(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".canvas");
}

/** Dot-folders with the pattern .<name>.cards or .<name>.events hold sub-notes. */
function isDotSubFolder(path: string): boolean {
  const segments = path.split("/");
  return segments.some((seg) => /^\.[^.].+\.(cards|events)$/.test(seg));
}

/**
 * Owns the NoteIndex and keeps it in sync with the Tome: a full build on start
 * and incremental updates driven by the file watcher (Observer).
 */
export class IndexService {
  readonly index: NoteIndex;

  constructor(
    private readonly tome: Tome,
    private readonly events: EventBus<TomeEventMap>,
    dbLocation: string,
  ) {
    this.index = new NoteIndex(dbLocation);
  }

  static async create(
    tome: Tome,
    events: EventBus<TomeEventMap>,
    dbLocation: string,
  ): Promise<IndexService> {
    if (dbLocation !== ":memory:") {
      await mkdir(dirname(dbLocation), { recursive: true });
    }
    return new IndexService(tome, events, dbLocation);
  }

  async buildFromTome(): Promise<void> {
    const entries = await this.tome.listTree({ includeDotfiles: true });
    const files: IndexInputFile[] = [];
    for (const path of flattenFiles(entries).filter(isIndexable)) {
      const linkable = !isDotSubFolder(path);
      files.push({ ...(await this.readFile(path)), linkable });
    }
    this.index.rebuild(files);
  }

  private async readFile(path: string): Promise<IndexInputFile> {
    const content = await this.tome.read(path);
    const stat = await this.tome.stat(path);
    return { path, content, mtimeMs: stat.mtimeMs };
  }

  subscribe(): void {
    this.events.on("tome:change", (change) => {
      void this.onChange(change);
    });
  }

  private async onChange(change: TomeChange): Promise<void> {
    if (!isIndexable(change.path)) {
      return;
    }
    if (change.kind === "deleted") {
      this.index.remove(change.path);
      return;
    }
    try {
      const file = await this.readFile(change.path);
      const linkable = !isDotSubFolder(change.path);
      this.index.upsert({ ...file, linkable });
    } catch {
      // File disappeared between event and read; remove any stale entry.
      this.index.remove(change.path);
    }
  }
}
