import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushQueue, loadQueue, pendingCount, queueWrite } from "./offline-queue";

function installLocalStorage(): void {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe("offline-queue", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("queues writes and replaces by path (latest wins)", () => {
    queueWrite({ path: "a.md", content: "v1" });
    queueWrite({ path: "b.md", content: "v1" });
    queueWrite({ path: "a.md", content: "v2" });
    const queue = loadQueue();
    expect(queue).toEqual([
      { path: "b.md", content: "v1" },
      { path: "a.md", content: "v2" },
    ]);
    expect(pendingCount()).toBe(2);
  });

  it("flushes successful writes and keeps failures queued", async () => {
    queueWrite({ path: "ok.md", content: "x" });
    queueWrite({ path: "bad.md", content: "y" });
    const write = vi.fn(async (path: string) => {
      if (path === "bad.md") {
        throw new Error("offline");
      }
    });
    const flushed = await flushQueue(write);
    expect(flushed).toBe(1);
    expect(loadQueue()).toEqual([{ path: "bad.md", content: "y" }]);
  });
});
