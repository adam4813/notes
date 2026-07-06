import { describe, expect, it } from "vitest";
import { CommandBus, CommandNotFoundError } from "./command-bus";
import type { Middleware, RequestContext } from "./contracts";

const ctx: RequestContext = { tomePath: "/tmp/tome" };

describe("CommandBus", () => {
  it("dispatches to the registered handler and returns its result", async () => {
    const bus = new CommandBus();
    bus.register<{ a: number; b: number }, number>({
      name: "math.add",
      handler: (payload) => payload.a + payload.b,
    });

    const result = await bus.dispatch<number>("math.add", { a: 2, b: 3 }, ctx);

    expect(result).toBe(5);
  });

  it("throws CommandNotFoundError for unknown commands", async () => {
    const bus = new CommandBus();
    await expect(bus.dispatch("missing", {}, ctx)).rejects.toBeInstanceOf(CommandNotFoundError);
  });

  it("runs middleware as an onion around the handler in registration order", async () => {
    const bus = new CommandBus();
    const order: string[] = [];

    const first: Middleware = async (_invocation, next) => {
      order.push("first:before");
      const result = await next();
      order.push("first:after");
      return result;
    };
    const second: Middleware = async (_invocation, next) => {
      order.push("second:before");
      const result = await next();
      order.push("second:after");
      return result;
    };

    bus.use(first);
    bus.use(second);
    bus.register({
      name: "noop",
      handler: () => {
        order.push("handler");
        return "ok";
      },
    });

    const result = await bus.dispatch<string>("noop", {}, ctx);

    expect(result).toBe("ok");
    expect(order).toEqual([
      "first:before",
      "second:before",
      "handler",
      "second:after",
      "first:after",
    ]);
  });

  it("prevents duplicate command registration", () => {
    const bus = new CommandBus();
    bus.register({ name: "dup", handler: () => null });
    expect(() => bus.register({ name: "dup", handler: () => null })).toThrow();
  });
});
