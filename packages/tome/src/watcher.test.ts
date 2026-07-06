import { describe, expect, it } from "vitest";
import { chokidarEventToKind } from "./watcher";

describe("chokidarEventToKind", () => {
  it("maps file lifecycle events to normalized kinds", () => {
    expect(chokidarEventToKind("add")).toBe("created");
    expect(chokidarEventToKind("change")).toBe("modified");
    expect(chokidarEventToKind("unlink")).toBe("deleted");
  });

  it("ignores directory and unknown events", () => {
    expect(chokidarEventToKind("addDir")).toBeUndefined();
    expect(chokidarEventToKind("unlinkDir")).toBeUndefined();
    expect(chokidarEventToKind("ready")).toBeUndefined();
  });
});
