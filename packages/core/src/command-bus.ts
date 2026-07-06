import type {
  CommandDefinition,
  CommandInvocation,
  CommandNext,
  Middleware,
  RequestContext,
} from "./contracts";

export class CommandNotFoundError extends Error {
  constructor(public readonly commandName: string) {
    super(`No command registered for "${commandName}"`);
    this.name = "CommandNotFoundError";
  }
}

/**
 * Central command bus. Every mutation flows through here (Command pattern),
 * wrapped by a middleware chain (Chain of Responsibility):
 * validate → plugins → handler → persist → emit.
 */
export class CommandBus {
  private readonly commands = new Map<string, CommandDefinition>();
  private readonly middleware: Middleware[] = [];

  register<TPayload, TResult>(command: CommandDefinition<TPayload, TResult>): void {
    if (this.commands.has(command.name)) {
      throw new Error(`Command "${command.name}" is already registered`);
    }
    this.commands.set(command.name, command as CommandDefinition);
  }

  unregister(name: string): boolean {
    return this.commands.delete(name);
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  names(): string[] {
    return [...this.commands.keys()];
  }

  use(middleware: Middleware): void {
    this.middleware.push(middleware);
  }

  async dispatch<TResult = unknown, TPayload = unknown>(
    name: string,
    payload: TPayload,
    ctx: RequestContext,
  ): Promise<TResult> {
    const command = this.commands.get(name);
    if (!command) {
      throw new CommandNotFoundError(name);
    }

    const invocation: CommandInvocation<TPayload> = { name, payload, ctx };
    const runHandler: CommandNext = async () => command.handler(payload, ctx);

    const chain = this.middleware.reduceRight<CommandNext>(
      (next, middleware) => () => middleware(invocation as CommandInvocation, next),
      runHandler,
    );

    return (await chain()) as TResult;
  }
}
