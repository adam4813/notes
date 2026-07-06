import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { resolveWithinRoot } from "./paths";

export interface TomeEntry {
  /** Root-relative, POSIX-separated path. */
  path: string;
  name: string;
  type: "file" | "directory";
  children?: TomeEntry[];
}

export interface TomeFileStat {
  path: string;
  size: number;
  mtimeMs: number;
  type: "file" | "directory";
}

const IGNORED_DIRECTORIES = new Set(["node_modules", ".git"]);

/**
 * A Tome is a folder of notes/files and the unit committed to git. File paths
 * are always root-relative; all access is confined to the root.
 */
export class Tome {
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  resolve(relativePath: string): string {
    return resolveWithinRoot(this.root, relativePath);
  }

  private toRelative(absolutePath: string): string {
    return relative(this.root, absolutePath).split(sep).join("/");
  }

  async ensureRoot(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await access(this.resolve(relativePath), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async read(relativePath: string): Promise<string> {
    return readFile(this.resolve(relativePath), "utf8");
  }

  /** Atomic write: content is written to a temp file, then renamed into place. */
  async write(relativePath: string, content: string): Promise<void> {
    const absolute = this.resolve(relativePath);
    await mkdir(dirname(absolute), { recursive: true });
    const temporary = `${absolute}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temporary, content, "utf8");
    await rename(temporary, absolute);
  }

  async create(relativePath: string, content = ""): Promise<void> {
    if (await this.exists(relativePath)) {
      throw new Error(`File already exists: ${relativePath}`);
    }
    await this.write(relativePath, content);
  }

  async rename(fromPath: string, toPath: string): Promise<void> {
    await this.move(fromPath, toPath);
  }

  async move(fromPath: string, toPath: string): Promise<void> {
    const fromAbsolute = this.resolve(fromPath);
    const toAbsolute = this.resolve(toPath);
    await mkdir(dirname(toAbsolute), { recursive: true });
    await rename(fromAbsolute, toAbsolute);
  }

  async delete(relativePath: string): Promise<void> {
    await rm(this.resolve(relativePath), { recursive: true, force: true });
  }

  async stat(relativePath: string): Promise<TomeFileStat> {
    const absolute = this.resolve(relativePath);
    const stats = await stat(absolute);
    return {
      path: this.toRelative(absolute),
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      type: stats.isDirectory() ? "directory" : "file",
    };
  }

  async listTree(options?: { includeDotfiles?: boolean }): Promise<TomeEntry[]> {
    const includeDotfiles = options?.includeDotfiles ?? false;
    await this.ensureRoot();

    const walk = async (absoluteDir: string): Promise<TomeEntry[]> => {
      const dirents = await readdir(absoluteDir, { withFileTypes: true });
      const entries: TomeEntry[] = [];

      for (const dirent of dirents.sort((a, b) => a.name.localeCompare(b.name))) {
        if (!includeDotfiles && dirent.name.startsWith(".")) {
          continue;
        }
        if (dirent.isDirectory() && IGNORED_DIRECTORIES.has(dirent.name)) {
          continue;
        }

        const absoluteChild = join(absoluteDir, dirent.name);
        const relativeChild = this.toRelative(absoluteChild);

        if (dirent.isDirectory()) {
          entries.push({
            path: relativeChild,
            name: dirent.name,
            type: "directory",
            children: await walk(absoluteChild),
          });
        } else {
          entries.push({ path: relativeChild, name: dirent.name, type: "file" });
        }
      }

      // Directories before files, each group alphabetical (already sorted above).
      return entries.sort((a, b) => {
        if (a.type === b.type) {
          return 0;
        }
        return a.type === "directory" ? -1 : 1;
      });
    };

    return walk(this.root);
  }
}
