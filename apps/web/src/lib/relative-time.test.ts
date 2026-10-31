import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relative-time";

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

describe("formatRelativeTime", () => {
  it("returns 'just now' for very recent timestamps", () => {
    expect(formatRelativeTime(NOW - 1000, NOW)).toBe("just now");
    expect(formatRelativeTime(NOW, NOW)).toBe("just now");
  });

  it("formats minutes in the past", () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe("5 minutes ago");
    expect(formatRelativeTime(NOW - 60_000, NOW)).toBe("1 minute ago");
  });

  it("formats hours in the past", () => {
    expect(formatRelativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3 hours ago");
  });

  it("formats days in the past", () => {
    expect(formatRelativeTime(NOW - 2 * 86_400_000, NOW)).toBe("2 days ago");
  });

  it("formats months and years in the past", () => {
    expect(formatRelativeTime(NOW - 60 * 86_400_000, NOW)).toBe("2 months ago");
    expect(formatRelativeTime(NOW - 400 * 86_400_000, NOW)).toBe("last year");
  });
});
