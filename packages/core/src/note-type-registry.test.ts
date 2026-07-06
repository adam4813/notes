import { describe, expect, it } from "vitest";
import type { NoteTypeProvider } from "./contracts";
import { markdownNoteType, MARKDOWN_NOTE_TYPE_ID } from "./markdown-note-type";
import { NoteTypeRegistry } from "./note-type-registry";

const tableType: NoteTypeProvider = {
  id: "table",
  detect: (file) => file.path.toLowerCase().endsWith(".md") && file.frontmatterType === "table",
};

describe("NoteTypeRegistry", () => {
  it("falls back to markdown for a plain .md file", () => {
    const registry = new NoteTypeRegistry();
    registry.register(markdownNoteType, { fallback: true });
    registry.register(tableType);

    const provider = registry.detect({ path: "notes/hello.md" });

    expect(provider?.id).toBe(MARKDOWN_NOTE_TYPE_ID);
  });

  it("prefers a specific provider over the markdown fallback", () => {
    const registry = new NoteTypeRegistry();
    registry.register(markdownNoteType, { fallback: true });
    registry.register(tableType);

    const provider = registry.detect({ path: "data/people.md", frontmatterType: "table" });

    expect(provider?.id).toBe("table");
  });

  it("returns undefined when nothing matches", () => {
    const registry = new NoteTypeRegistry();
    registry.register(markdownNoteType, { fallback: true });

    expect(registry.detect({ path: "diagram.canvas" })).toBeUndefined();
  });
});
