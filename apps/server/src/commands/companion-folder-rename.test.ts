import { describe, expect, it, vi } from "vitest";
import type { Tome } from "@notes/tome";
import { renameCompanionFolder } from "./companion-folder-rename";

describe("companion-folder-rename", () => {
  it("moves a companion folder when the path builder changes", async () => {
    const exists = vi.fn().mockResolvedValue(true);
    const move = vi.fn().mockResolvedValue(undefined);
    const tome = { exists, move } as unknown as Tome;

    await renameCompanionFolder(tome, "notes/roadmap.md", "archive/roadmap.md", (path) =>
      path.replace(/\.md$/, ".cards"),
    );

    expect(exists).toHaveBeenCalledWith("notes/roadmap.cards");
    expect(move).toHaveBeenCalledWith("notes/roadmap.cards", "archive/roadmap.cards");
  });

  it("skips moving when the folder path stays the same", async () => {
    const exists = vi.fn();
    const move = vi.fn();
    const tome = { exists, move } as unknown as Tome;

    await renameCompanionFolder(tome, "notes/roadmap.md", "notes/roadmap.md", (path) => path);

    expect(exists).not.toHaveBeenCalled();
    expect(move).not.toHaveBeenCalled();
  });
});
