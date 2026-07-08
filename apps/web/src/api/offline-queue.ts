/**
 * Offline-safe write buffer. When a note write fails (e.g. the server is
 * unreachable), the edit is queued in localStorage keyed by path (latest wins)
 * so it is never lost, then flushed when connectivity returns.
 */

const KEY = "notes.pendingWrites";

export interface PendingWrite {
  path: string;
  content: string;
}

export function loadQueue(): PendingWrite[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as PendingWrite[]) : [];
  } catch {
    return [];
  }
}

function save(queue: PendingWrite[]): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(queue));
  } catch {
    // ignore storage quota/access errors
  }
}

/** Queues (or replaces) a pending write for a path. */
export function queueWrite(write: PendingWrite): void {
  const queue = loadQueue().filter((entry) => entry.path !== write.path);
  queue.push(write);
  save(queue);
}

export function pendingCount(): number {
  return loadQueue().length;
}

/**
 * Attempts to flush every queued write. Successful writes are removed; failures
 * remain queued for a later attempt. Returns the number of flushed writes.
 */
export async function flushQueue(
  write: (path: string, content: string) => Promise<unknown>,
): Promise<number> {
  const queue = loadQueue();
  if (queue.length === 0) {
    return 0;
  }
  const remaining: PendingWrite[] = [];
  let flushed = 0;
  for (const entry of queue) {
    try {
      await write(entry.path, entry.content);
      flushed += 1;
    } catch {
      remaining.push(entry);
    }
  }
  save(remaining);
  return flushed;
}
