import { describe, expect, it } from "vitest";
import type { NoteTypeDetector } from "./contracts";
import { NoteTypeRegistry } from "./note-type-registry";

const testNoteType: NoteTypeDetector = {
  id: "test",
  detect: (file) => file.path.toLowerCase().endsWith(".test"),
};

const tableType: NoteTypeDetector = {
  id: "table",
  detect: (file) => file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "table",
};

describe("NoteTypeRegistry", () => {
  it("falls back to markdown for a plain .md file", () => {
    const registry = new NoteTypeRegistry();
    registry.register(testNoteType, { fallback: true });
    registry.register(tableType);

    const provider = registry.detect({ path: "notes/hello.test" });

    expect(provider?.id).toBe("test");
  });

  it("prefers a specific provider over the markdown fallback", () => {
    const registry = new NoteTypeRegistry();
    registry.register(testNoteType, { fallback: true });
    registry.register(tableType);

    const provider = registry.detect({ path: "data/people.md", frontmatterType: "table" });

    expect(provider?.id).toBe("table");
  });

  it("returns undefined when nothing matches", () => {
    const registry = new NoteTypeRegistry();
    registry.register(testNoteType, { fallback: true });

    expect(registry.detect({ path: "diagram.canvas" })).toBeUndefined();
  });
});
