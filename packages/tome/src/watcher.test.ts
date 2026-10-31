import { describe, expect, it } from "vitest";
import { chokidarEventToKind } from "./watcher";

describe("chokidarEventToKind", () => {
  it("maps file lifecycle events to normalized kinds", () => {
    expect(chokidarEventToKind("add")).toBe("created");
    expect(chokidarEventToKind("change")).toBe("modified");
    expect(chokidarEventToKind("unlink")).toBe("deleted");
  });

  it("maps directory lifecycle events so folder changes refresh the explorer", () => {
    expect(chokidarEventToKind("addDir")).toBe("created");
    expect(chokidarEventToKind("unlinkDir")).toBe("deleted");
  });

  it("ignores unknown events", () => {
    expect(chokidarEventToKind("ready")).toBeUndefined();
    expect(chokidarEventToKind("raw")).toBeUndefined();
  });
});
