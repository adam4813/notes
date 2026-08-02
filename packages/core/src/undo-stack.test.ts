import { describe, it, expect, vi } from "vitest";
import { InMemoryUndoStore, UndoStack, type UndoEntry } from "./undo-stack";

function makeEntry(label: string, undo = vi.fn(), redo = vi.fn()): UndoEntry {
  return {
    label,
    undo: async () => {
      undo();
    },
    redo: async () => {
      redo();
    },
  };
}

describe("InMemoryUndoStore", () => {
  it("starts empty", () => {
    const store = new InMemoryUndoStore();
    expect(store.undoSize).toBe(0);
    expect(store.redoSize).toBe(0);
    expect(store.peekUndo()).toBeUndefined();
    expect(store.peekRedo()).toBeUndefined();
  });

  it("recordNew pushes to past and clears future", () => {
    const store = new InMemoryUndoStore();
    const a = makeEntry("a");
    const b = makeEntry("b");
    store.recordNew(a);
    store.pushRedo(b);
    expect(store.redoSize).toBe(1);
    store.recordNew(makeEntry("c"));
    expect(store.undoSize).toBe(2);
    expect(store.redoSize).toBe(0); // future cleared
  });

  it("pushUndo does not clear future", () => {
    const store = new InMemoryUndoStore();
    store.pushRedo(makeEntry("future"));
    store.pushUndo(makeEntry("past"));
    expect(store.undoSize).toBe(1);
    expect(store.redoSize).toBe(1);
  });

  it("pushRedo does not affect past", () => {
    const store = new InMemoryUndoStore();
    store.recordNew(makeEntry("past"));
    store.pushRedo(makeEntry("future"));
    expect(store.undoSize).toBe(1);
    expect(store.redoSize).toBe(1);
  });

  it("evicts oldest entries when maxSize is exceeded", () => {
    const store = new InMemoryUndoStore(3);
    store.recordNew(makeEntry("a"));
    store.recordNew(makeEntry("b"));
    store.recordNew(makeEntry("c"));
    store.recordNew(makeEntry("d")); // evicts "a"
    expect(store.undoSize).toBe(3);
    expect(store.peekUndo()?.label).toBe("d");
  });

  it("peekUndo returns the most recent entry without removing it", () => {
    const store = new InMemoryUndoStore();
    store.recordNew(makeEntry("first"));
    store.recordNew(makeEntry("second"));
    expect(store.peekUndo()?.label).toBe("second");
    expect(store.undoSize).toBe(2);
  });

  it("popUndo removes the most recent entry", () => {
    const store = new InMemoryUndoStore();
    store.recordNew(makeEntry("a"));
    store.recordNew(makeEntry("b"));
    expect(store.popUndo()?.label).toBe("b");
    expect(store.undoSize).toBe(1);
  });

  it("clear empties both past and future", () => {
    const store = new InMemoryUndoStore();
    store.recordNew(makeEntry("a"));
    store.pushRedo(makeEntry("r"));
    store.clear();
    expect(store.undoSize).toBe(0);
    expect(store.redoSize).toBe(0);
  });
});

describe("UndoStack", () => {
  it("starts with canUndo=false, canRedo=false", () => {
    const stack = new UndoStack();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
    expect(stack.undoLabel).toBeUndefined();
    expect(stack.redoLabel).toBeUndefined();
  });

  it("push makes canUndo true", () => {
    const stack = new UndoStack();
    stack.push(makeEntry("create"));
    expect(stack.canUndo).toBe(true);
    expect(stack.undoLabel).toBe("create");
  });

  it("undo calls the undo fn and makes canRedo true", async () => {
    const undoFn = vi.fn();
    const stack = new UndoStack();
    stack.push(makeEntry("delete", undoFn));
    const label = await stack.undo();
    expect(label).toBe("delete");
    expect(undoFn).toHaveBeenCalledOnce();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(true);
    expect(stack.redoLabel).toBe("delete");
  });

  it("redo calls the redo fn and makes canUndo true again", async () => {
    const redoFn = vi.fn();
    const stack = new UndoStack();
    stack.push(makeEntry("rename", vi.fn(), redoFn));
    await stack.undo();
    const label = await stack.redo();
    expect(label).toBe("rename");
    expect(redoFn).toHaveBeenCalledOnce();
    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(false);
  });

  it("push after undo clears redo history", async () => {
    const stack = new UndoStack();
    stack.push(makeEntry("a"));
    await stack.undo();
    expect(stack.canRedo).toBe(true);
    stack.push(makeEntry("b")); // new action clears redo
    expect(stack.canRedo).toBe(false);
  });

  it("undo returns null when stack is empty", async () => {
    const stack = new UndoStack();
    expect(await stack.undo()).toBeNull();
  });

  it("redo returns null when nothing to redo", async () => {
    const stack = new UndoStack();
    stack.push(makeEntry("a"));
    expect(await stack.redo()).toBeNull();
  });

  it("supports multiple undo/redo cycles", async () => {
    const log: string[] = [];
    const stack = new UndoStack();
    stack.push({
      label: "step1",
      undo: async () => {
        log.push("undo1");
      },
      redo: async () => {
        log.push("redo1");
      },
    });
    stack.push({
      label: "step2",
      undo: async () => {
        log.push("undo2");
      },
      redo: async () => {
        log.push("redo2");
      },
    });
    await stack.undo(); // undo step2
    await stack.undo(); // undo step1
    await stack.redo(); // redo step1
    await stack.redo(); // redo step2
    expect(log).toEqual(["undo2", "undo1", "redo1", "redo2"]);
  });

  it("notifies subscribers on push/undo/redo/clear", async () => {
    const listener = vi.fn();
    const stack = new UndoStack();
    const unsub = stack.subscribe(listener);
    stack.push(makeEntry("a"));
    await stack.undo();
    await stack.redo();
    stack.clear();
    expect(listener).toHaveBeenCalledTimes(4);
    unsub();
    stack.push(makeEntry("after-unsub"));
    expect(listener).toHaveBeenCalledTimes(4); // no more calls
  });

  it("clear resets canUndo and canRedo", async () => {
    const stack = new UndoStack();
    stack.push(makeEntry("a"));
    await stack.undo();
    stack.clear();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
  });

  it("respects custom store max size", async () => {
    const store = new InMemoryUndoStore(2);
    const stack = new UndoStack(store);
    stack.push(makeEntry("a"));
    stack.push(makeEntry("b"));
    stack.push(makeEntry("c")); // evicts "a"
    let count = 0;
    while (stack.canUndo) {
      await stack.undo();
      count++;
    }
    expect(count).toBe(2); // only b and c survive
  });
});
