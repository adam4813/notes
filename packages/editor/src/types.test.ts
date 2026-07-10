import { describe, expect, it } from "vitest";
import { droppedPathInsertion, wikilinkTargetFromPath } from "./types";

describe("wikilinkTargetFromPath", () => {
  it("strips markdown extension for note targets", () => {
    expect(wikilinkTargetFromPath("notes/Welcome.md")).toBe("notes/Welcome");
  });

  it("keeps extension for media files", () => {
    expect(wikilinkTargetFromPath("media/pasted-20260710200412-0fff01c194.png")).toBe(
      "media/pasted-20260710200412-0fff01c194.png",
    );
  });
});

describe("droppedPathInsertion", () => {
  it("uses img tag embeds for images", () => {
    expect(droppedPathInsertion("media/pic.png", false)).toBe(
      '<img src="/api/file/raw?path=media%2Fpic.png" alt="pic.png">',
    );
  });
});
