/**
 * Public extension-point contracts. These interfaces are the surface that
 * first-party note types and third-party plugins register against. Keep this
 * module free of any runtime I/O.
 */

/** Context threaded through every command dispatch. */
export interface RequestContext {
  readonly tomePath: string;
  /** Reserved for future auth/multi-user; unused in MVP. */
  readonly userId?: string;
}

export interface CommandInvocation<TPayload = unknown> {
  readonly name: string;
  readonly payload: TPayload;
  readonly ctx: RequestContext;
}

export type CommandHandler<TPayload = unknown, TResult = unknown> = (
  payload: TPayload,
  ctx: RequestContext,
) => Promise<TResult> | TResult;

export interface CommandDefinition<TPayload = unknown, TResult = unknown> {
  readonly name: string;
  readonly handler: CommandHandler<TPayload, TResult>;
  /**
   * When true, this command is a mutation (creates, deletes, or modifies data).
   * The command event middleware uses this flag to emit domain events after success.
   * Read-only queries should omit this (defaults to false).
   */
  readonly mutates?: boolean;
}

export type CommandNext = () => Promise<unknown>;

/** Chain-of-Responsibility middleware wrapping command dispatch. */
export type Middleware = (invocation: CommandInvocation, next: CommandNext) => Promise<unknown>;

/** Minimal description of a file used for note-type detection. */
export interface NoteFileDescriptor {
  readonly path: string;
  readonly frontmatterType?: string;
}

/**
 * Minimal interface for note-type detection — used server-side to match a
 * file to its type. Only carries identity and the detect predicate.
 *
 * The full note-type descriptor (with React view capabilities) is
 * NoteTypeDescriptor in packages/editor, which extends this interface.
 */
export interface NoteTypeDetector {
  readonly id: string;
  detect(file: NoteFileDescriptor): boolean;
}
