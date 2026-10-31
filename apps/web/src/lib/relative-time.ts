/** Thresholds (in seconds) and their unit divisors for relative formatting. */
const UNITS: { limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60, divisor: 1, unit: "second" },
  { limit: 3600, divisor: 60, unit: "minute" },
  { limit: 86400, divisor: 3600, unit: "hour" },
  { limit: 2592000, divisor: 86400, unit: "day" },
  { limit: 31536000, divisor: 2592000, unit: "month" },
  { limit: Infinity, divisor: 31536000, unit: "year" },
];

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/**
 * Formats a past timestamp (ms since epoch) as a short relative string such as
 * "just now", "5 minutes ago", or "2 days ago".
 */
export function formatRelativeTime(timestampMs: number, now = Date.now()): string {
  const diffSeconds = Math.round((timestampMs - now) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 5) {
    return "just now";
  }
  for (const { limit, divisor, unit } of UNITS) {
    if (abs < limit) {
      return rtf.format(Math.round(diffSeconds / divisor), unit);
    }
  }
  return "just now";
}
