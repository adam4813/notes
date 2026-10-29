export type LogLevel = "error" | "warn" | "info" | "debug";

export interface LogEntry {
  id: string;
  level: LogLevel;
  /** User-visible source label, e.g. "Client", "App". */
  source: string;
  message: string;
  /** Stack trace string, if available (typically from Error objects). */
  stack?: string;
  timestamp: number;
}

export const MAX_LOG_ENTRIES = 1000;

const buffer: LogEntry[] = [];
const logListeners = new Set<(entry: LogEntry) => void>();
const clearListeners = new Set<() => void>();
let counter = 0;
let intercepted = false;

export function appLog(level: LogLevel, message: string, source = "App", stack?: string): void {
  const entry: LogEntry = {
    id: `log-${Date.now()}-${++counter}`,
    level,
    source,
    message,
    stack,
    timestamp: Date.now(),
  };
  buffer.push(entry);
  if (buffer.length > MAX_LOG_ENTRIES) {
    buffer.shift();
  }
  for (const listener of logListeners) {
    listener(entry);
  }
}

/** Subscribe to new log entries. Returns an unsubscribe function. */
export function onLog(listener: (entry: LogEntry) => void): () => void {
  logListeners.add(listener);
  return () => logListeners.delete(listener);
}

/** Subscribe to buffer-clear events. Returns an unsubscribe function. */
export function onClear(listener: () => void): () => void {
  clearListeners.add(listener);
  return () => clearListeners.delete(listener);
}

/** Returns a snapshot of all buffered log entries. */
export function getLogEntries(): readonly LogEntry[] {
  return buffer;
}

/** Returns the count of error and warn entries in the current buffer. */
export function getErrorWarnCount(): { errors: number; warns: number } {
  let errors = 0;
  let warns = 0;
  for (const e of buffer) {
    if (e.level === "error") errors++;
    else if (e.level === "warn") warns++;
  }
  return { errors, warns };
}

/** Clears all buffered entries and notifies clear subscribers. */
export function clearLog(): void {
  buffer.length = 0;
  for (const listener of clearListeners) {
    listener();
  }
}

/**
 * Patches console.error / .warn / .log / .info to mirror entries into appLog.
 * Safe to call multiple times — only patches once. Returns a restore function.
 */
export function interceptConsole(): () => void {
  if (intercepted) return () => undefined;
  intercepted = true;

  const orig = {
    error: console.error,
    warn: console.warn,
    log: console.log,
    info: console.info,
  };

  function patch(level: LogLevel, method: keyof typeof orig): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (console as any)[method] = (...args: unknown[]) => {
      orig[method].call(console, ...(args as Parameters<typeof orig.error>));
      const message = args
        .map((a) =>
          typeof a === "string" ? a : a instanceof Error ? a.message : JSON.stringify(a),
        )
        .join(" ");
      const err = args.find((a): a is Error => a instanceof Error);
      appLog(level, message, "Client", err?.stack);
    };
  }

  patch("error", "error");
  patch("warn", "warn");
  patch("info", "log");
  patch("info", "info");

  return () => {
    intercepted = false;
    console.error = orig.error;
    console.warn = orig.warn;
    console.log = orig.log;
    console.info = orig.info;
  };
}
