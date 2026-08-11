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

/** The editor modes a note-type view may support. */
export type NoteViewMode = "edit" | "split" | "rendered";

/**
 * A toolbar item contributed by a note type. The `element` field is opaque
 * here (unknown) and narrowed to ReactNode by the editor layer.
 */
export interface NoteTypeToolbarItem {
  /** Unique id, e.g. "canvas.zoom-in". */
  id: string;
  /**
   * When set, replaces the built-in toolbar button with this id.
   * When omitted, the item is appended after the built-in buttons.
   */
  replace?: string;
  /** Opaque ReactNode resolved by the editor layer. */
  element: unknown;
}

/** Strategy/Factory provider for a note type (markdown, table, canvas, board, …). */
export interface NoteTypeDescriptor {
  readonly id: string;
  detect(file: NoteFileDescriptor): boolean;

  // ── UI capabilities (all optional) ─────────────────────────────
  /**
   * Which editor modes this note type supports.
   * Defaults to all three: ["edit", "split", "rendered"].
   */
  supportedModes?: NoteViewMode[];
  /**
   * When true, the source pane displays raw text as read-only unless the user
   * explicitly unlocks it (appropriate for canvas, table, board notes).
   */
  sourceProtected?: boolean;
  /**
   * Whether this type supports scroll / cursor / focus synchronisation between
   * source and rendered panes in split mode. Defaults to false.
   */
  supportsScrollSync?: boolean;
  /**
   * Opaque view-component token. The editor package resolves this to a
   * React ComponentType<RendererProps> via the NoteTypeRegistry.
   */
  viewComponent?: unknown;
  /**
   * Toolbar items contributed by this note type. Each entry may append a new
   * button or replace an existing built-in button by id.
   */
  toolbarItems?: NoteTypeToolbarItem[];
  /**
   * Context-menu item builder. Opaque here; typed in the editor / ui layer.
   * Receives the clicked HTMLElement and returns ContextMenuEntry[].
   */
  contextMenuBuilder?: unknown;
}
