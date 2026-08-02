import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  useState,
  type ReactNode,
} from "react";
import { InMemoryUndoStore, UndoStack } from "@notes/core";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const UndoStackContext = createContext<UndoStack | null>(null);

function useNearestStack(): UndoStack {
  const stack = useContext(UndoStackContext);
  if (!stack) {
    throw new Error("useUndoStack must be used within an UndoStackProvider or UndoScope");
  }
  return stack;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/**
 * Provides the global undo stack for the whole app. Wrap this near the root
 * (inside WorkspaceProvider is fine).
 */
export function UndoStackProvider({ children }: { children: ReactNode }) {
  const [stack] = useState(() => new UndoStack(new InMemoryUndoStore(100)));
  return <UndoStackContext.Provider value={stack}>{children}</UndoStackContext.Provider>;
}

/**
 * Creates a child undo stack scoped to the component tree below it (e.g. a modal).
 * Ctrl+Z within this subtree will target the scoped stack, not the global one.
 * The scoped stack is discarded when the component unmounts.
 */
export function UndoScope({ maxSize = 20, children }: { maxSize?: number; children: ReactNode }) {
  const [stack] = useState(() => new UndoStack(new InMemoryUndoStore(maxSize)));
  return <UndoStackContext.Provider value={stack}>{children}</UndoStackContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Returns the nearest UndoStack (global or scoped).
 * Use this when you need direct access to the stack instance (e.g. to call `.push()`).
 */
export function useUndoStack(): UndoStack {
  return useNearestStack();
}

/**
 * Returns reactive canUndo/canRedo/label state from the nearest stack.
 * Re-renders whenever the stack changes (push/undo/redo/clear).
 */
export function useUndoState(): {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | undefined;
  redoLabel: string | undefined;
} {
  const stack = useNearestStack();

  const getSnapshot = useCallback(
    () => ({
      canUndo: stack.canUndo,
      canRedo: stack.canRedo,
      undoLabel: stack.undoLabel,
      redoLabel: stack.redoLabel,
    }),
    [stack],
  );

  // useSyncExternalStore requires a stable snapshot reference to avoid spurious
  // re-renders. We serialize the key values into a string for cheap comparison.
  const getCacheKey = useCallback(
    () =>
      `${String(stack.canUndo)}|${String(stack.canRedo)}|${stack.undoLabel ?? ""}|${stack.redoLabel ?? ""}`,
    [stack],
  );

  useSyncExternalStore(
    useCallback((cb) => stack.subscribe(cb), [stack]),
    getCacheKey,
    getCacheKey,
  );

  return getSnapshot();
}
