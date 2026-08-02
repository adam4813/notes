/**
 * Undo/redo stack infrastructure (Command pattern).
 *
 * Design goals:
 * - Call-sites push UndoEntry objects; they don't orchestrate undo logic themselves.
 * - The backend (UndoStackStore) is a Strategy so it can be swapped for disk or
 *   server-side persistence without changing consumers.
 * - Scoped stacks (e.g. inside a modal) shadow the global stack via React context.
 */

/** A reversible operation that can be undone and redone. */
export interface UndoEntry {
  /** Human-readable label shown in UI: "Undo delete 'my-note.md'" */
  label: string;
  undo?: () => Promise<UndoEntry | undefined | void>;
  redo?: () => Promise<UndoEntry | undefined | void>;
}

/** Strategy for storing undo entries. Swap for disk/server backends as needed. */
export interface UndoStackStore {
  /**
   * Record a brand-new user action: push to past and clear the redo (future) side.
   * This is the "normal" push called by `UndoStack.push()`.
   */
  recordNew(entry: UndoEntry): void;
  /** Internal: push to the past side only, without touching the redo side. */
  pushUndo(entry: UndoEntry): void;
  /** Internal: push to the redo (future) side only, without touching the undo side. */
  pushRedo(entry: UndoEntry): void;
  popUndo(): UndoEntry | undefined;
  popRedo(): UndoEntry | undefined;
  peekUndo(): UndoEntry | undefined;
  peekRedo(): UndoEntry | undefined;
  clear(): void;
  readonly undoSize: number;
  readonly redoSize: number;
}

/** Default in-memory store with a capped past/future deque. */
export class InMemoryUndoStore implements UndoStackStore {
  private readonly past: UndoEntry[] = [];
  private readonly future: UndoEntry[] = [];

  constructor(private readonly maxSize: number = 100) {}

  recordNew(entry: UndoEntry): void {
    this.past.push(entry);
    if (this.past.length > this.maxSize) {
      this.past.shift();
    }
    this.future.length = 0;
  }

  pushUndo(entry: UndoEntry): void {
    this.past.push(entry);
    if (this.past.length > this.maxSize) {
      this.past.shift();
    }
  }

  pushRedo(entry: UndoEntry): void {
    this.future.push(entry);
  }

  popUndo(): UndoEntry | undefined {
    return this.past.pop();
  }

  popRedo(): UndoEntry | undefined {
    return this.future.pop();
  }

  peekUndo(): UndoEntry | undefined {
    return this.past[this.past.length - 1];
  }

  peekRedo(): UndoEntry | undefined {
    return this.future[this.future.length - 1];
  }

  clear(): void {
    this.past.length = 0;
    this.future.length = 0;
  }

  get undoSize(): number {
    return this.past.length;
  }

  get redoSize(): number {
    return this.future.length;
  }
}

type ChangeListener = () => void;

/**
 * Global (or scoped) undo/redo stack.
 *
 * Usage:
 *   stack.push({ label: 'Create note', undo: () => api.remove(path), redo: () => api.create(path, content) });
 *   await stack.undo(); // calls the undo fn, moves entry to redo side
 *   await stack.redo(); // re-executes
 */
export class UndoStack {
  private readonly store: UndoStackStore;
  private readonly listeners = new Set<ChangeListener>();

  constructor(store?: UndoStackStore) {
    this.store = store ?? new InMemoryUndoStore();
  }

  /** Subscribe to stack changes (push/undo/redo/clear). Returns an unsubscribe fn. */
  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Push a new undoable entry. Clears the redo history (same as any normal text editor).
   */
  push(entry: UndoEntry): void {
    this.store.recordNew(entry);
    this.notify();
  }

  /** Undo the most recent entry. Returns its label, or null if nothing to undo. */
  async undo(): Promise<string | null> {
    const entry = this.store.popUndo();
    if (!entry) return null;
    const redoEntry = entry.undo ? await entry.undo() : undefined;
    this.store.pushRedo(redoEntry ?? entry);
    this.notify();
    return entry.label;
  }

  /** Redo the most recently undone entry. Returns its label, or null if nothing to redo. */
  async redo(): Promise<string | null> {
    const entry = this.store.popRedo();
    if (!entry) return null;
    const undoEntry = entry.redo ? await entry.redo() : undefined;
    this.store.pushUndo(undoEntry ?? entry);
    this.notify();
    return entry.label;
  }

  get canUndo(): boolean {
    return this.store.undoSize > 0;
  }

  get canRedo(): boolean {
    return this.store.redoSize > 0;
  }

  get undoLabel(): string | undefined {
    return this.store.peekUndo()?.label;
  }

  get redoLabel(): string | undefined {
    return this.store.peekRedo()?.label;
  }

  clear(): void {
    this.store.clear();
    this.notify();
  }
}
