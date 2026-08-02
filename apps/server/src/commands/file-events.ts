import type { EventBus } from "@notes/core";

// ---------------------------------------------------------------------------
// File command event map — emitted after each mutating file.* command succeeds
// ---------------------------------------------------------------------------

export type FileCommandEventMap = {
  "file.created": { path: string };
  "file.written": { path: string };
  "file.deleted": { path: string };
  "file.renamed": { from: string; to: string };
  "file.mkdir": { path: string };
};

export function emitFileCreated(
  events: EventBus<FileCommandEventMap>,
  payload: FileCommandEventMap["file.created"],
): Promise<void> {
  return events.emit("file.created", payload);
}

export function emitFileWritten(
  events: EventBus<FileCommandEventMap>,
  payload: FileCommandEventMap["file.written"],
): Promise<void> {
  return events.emit("file.written", payload);
}

export function emitFileDeleted(
  events: EventBus<FileCommandEventMap>,
  payload: FileCommandEventMap["file.deleted"],
): Promise<void> {
  return events.emit("file.deleted", payload);
}

export function emitFileRenamed(
  events: EventBus<FileCommandEventMap>,
  payload: FileCommandEventMap["file.renamed"],
): Promise<void> {
  return events.emit("file.renamed", payload);
}

export function emitFileMkdir(
  events: EventBus<FileCommandEventMap>,
  payload: FileCommandEventMap["file.mkdir"],
): Promise<void> {
  return events.emit("file.mkdir", payload);
}
