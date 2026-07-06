/**
 * Placeholder command-bus contract.
 *
 * All mutations flow through the server command bus. The real implementation
 * (with middleware pipeline, note-type registry, and plugin hooks) lands in
 * Phase 1 inside `@notes/core`. This stub exists only so the server wiring
 * compiles and boots during Phase 0.
 */
export interface CommandContext {
  readonly tomePath: string;
}

export interface CommandBus {
  dispatch<TPayload, TResult>(
    name: string,
    payload: TPayload,
    ctx: CommandContext,
  ): Promise<TResult>;
}

export function createPlaceholderCommandBus(): CommandBus {
  return {
    async dispatch() {
      throw new Error("Command bus is not implemented until Phase 1.");
    },
  };
}
