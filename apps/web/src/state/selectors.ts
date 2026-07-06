import type { FileEntry } from "../api/client";

/** Flattens the file tree into a list of file entries (directories omitted). */
export function flattenFiles(tree: FileEntry[]): FileEntry[] {
  const files: FileEntry[] = [];
  const walk = (entries: FileEntry[]): void => {
    for (const entry of entries) {
      if (entry.type === "directory") {
        walk(entry.children ?? []);
      } else {
        files.push(entry);
      }
    }
  };
  walk(tree);
  return files;
}
