import { api } from "./client";
import type { UndoStack } from "@notes/core";

/**
 * Returns a set of file-level operations that automatically push undo/redo
 * entries to the provided stack. Call-sites invoke these functions normally;
 * the undo/redo registration is transparent.
 *
 * Note: text-edit undo (inside the TipTap editor) is handled by TipTap
 * internally and is not registered here.
 */
export function makeUndoableFileOps(stack: UndoStack) {
  /**
   * Creates a new file and registers an undo entry that deletes it.
   * If the file already exists this will throw (same as api.create).
   */
  async function createFile(path: string, content = ""): Promise<void> {
    await api.create(path, content);
    const name = path.split("/").pop() ?? path;
    stack.push({
      label: `Create "${name}"`,
      undo: async () => {
        await api.remove(path);
      },
      redo: async () => {
        await api.create(path, content);
      },
    });
  }

  /**
   * Deletes a file and registers an undo entry that re-creates it with the
   * original content. Reads the file content before deletion so the undo
   * entry is self-contained.
   */
  async function deleteFile(path: string): Promise<void> {
    const name = path.split("/").pop() ?? path;
    let previous = "";
    try {
      previous = (await api.read(path)).content;
    } catch {
      previous = "";
    }
    await api.remove(path);
    stack.push({
      label: `Delete "${name}"`,
      undo: async () => {
        await api.create(path, previous);
      },
      redo: async () => {
        await api.remove(path);
      },
    });
  }

  /**
   * Renames/moves a file and registers an undo entry that renames it back.
   */
  async function renameFile(from: string, to: string): Promise<void> {
    const toName = to.split("/").pop() ?? to;
    await api.rename(from, to);
    stack.push({
      label: `Rename to "${toName}"`,
      undo: async () => {
        await api.rename(to, from);
      },
      redo: async () => {
        await api.rename(from, to);
      },
    });
  }

  return { createFile, deleteFile, renameFile };
}

export type UndoableFileOps = ReturnType<typeof makeUndoableFileOps>;
