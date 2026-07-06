import type { Middleware } from "@notes/core";
import { commandSchemas } from "@notes/shared";

/** Validates command payloads against their zod schema, when one is registered. */
export const validationMiddleware: Middleware = async (invocation, next) => {
  const schema = commandSchemas[invocation.name];
  if (schema) {
    schema.parse(invocation.payload);
  }
  return next();
};

/** Logs each command dispatch with timing. */
export function createLoggingMiddleware(log: (message: string) => void): Middleware {
  return async (invocation, next) => {
    const start = Date.now();
    try {
      return await next();
    } finally {
      log(`command ${invocation.name} (${Date.now() - start}ms)`);
    }
  };
}
