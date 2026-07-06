import { describe, expect, it, vi } from "vitest";
import { EventBus } from "./event-bus";

interface TestEvents extends Record<string, unknown> {
  ping: { value: number };
}

describe("EventBus", () => {
  it("delivers emitted payloads to listeners", () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.on("ping", listener);

    bus.emit("ping", { value: 42 });

    expect(listener).toHaveBeenCalledWith({ value: 42 });
  });

  it("stops delivering after unsubscribe", () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    const off = bus.on("ping", listener);

    off();
    bus.emit("ping", { value: 1 });

    expect(listener).not.toHaveBeenCalled();
  });
});
