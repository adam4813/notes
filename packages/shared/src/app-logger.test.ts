import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appLog,
  clearLog,
  getErrorWarnCount,
  getLogEntries,
  interceptConsole,
  MAX_LOG_ENTRIES,
  onClear,
  onLog,
} from "./app-logger";

// Re-import the module to get a fresh buffer for each test
beforeEach(() => {
  clearLog();
});

describe("appLog / buffer", () => {
  it("adds entries and returns them via getLogEntries", () => {
    appLog("error", "boom", "Client");
    appLog("warn", "careful", "App");
    const entries = getLogEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].level).toBe("error");
    expect(entries[0].message).toBe("boom");
    expect(entries[1].level).toBe("warn");
  });

  it("caps buffer at MAX_LOG_ENTRIES, dropping oldest", () => {
    for (let i = 0; i < MAX_LOG_ENTRIES + 5; i++) {
      appLog("info", `msg ${i}`, "App");
    }
    expect(getLogEntries()).toHaveLength(MAX_LOG_ENTRIES);
    // Oldest entries were dropped; last entry is the newest
    const last = getLogEntries()[MAX_LOG_ENTRIES - 1];
    expect(last.message).toBe(`msg ${MAX_LOG_ENTRIES + 4}`);
  });
});

describe("onLog subscription", () => {
  it("notifies listeners on each new entry", () => {
    const received: string[] = [];
    const unsub = onLog((e) => received.push(e.message));
    appLog("info", "hello", "App");
    appLog("warn", "world", "App");
    unsub();
    appLog("error", "ignored", "App");
    expect(received).toEqual(["hello", "world"]);
  });
});

describe("clearLog", () => {
  it("empties the buffer", () => {
    appLog("error", "e1", "App");
    clearLog();
    expect(getLogEntries()).toHaveLength(0);
  });

  it("notifies onClear listeners", () => {
    const cleared = vi.fn();
    const unsub = onClear(cleared);
    appLog("info", "x", "App");
    clearLog();
    expect(cleared).toHaveBeenCalledOnce();
    unsub();
  });
});

describe("getErrorWarnCount", () => {
  it("counts only error and warn entries", () => {
    appLog("error", "e", "App");
    appLog("warn", "w", "App");
    appLog("info", "i", "App");
    appLog("debug", "d", "App");
    const { errors, warns } = getErrorWarnCount();
    expect(errors).toBe(1);
    expect(warns).toBe(1);
  });
});

describe("interceptConsole", () => {
  it("mirrors console.error to the buffer and restores on cleanup", () => {
    const originalError = console.error;
    const restore = interceptConsole();
    console.error("test error");
    restore();
    // After restore, the patch is removed
    expect(console.error).toBe(originalError);
    const entries = getLogEntries();
    expect(entries.some((e) => e.level === "error" && e.message.includes("test error"))).toBe(true);
  });

  it("is idempotent — calling twice only patches once", () => {
    const r1 = interceptConsole();
    const r2 = interceptConsole();
    const patchedError = console.error;
    r2(); // second restore is a no-op
    expect(console.error).toBe(patchedError); // still patched
    r1();
  });
});
