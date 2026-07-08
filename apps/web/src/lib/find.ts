/**
 * Pure helpers for in-note find/replace over the markdown source string.
 * DOM highlighting lives in the find-bar component; these functions provide
 * the match offsets and replacement logic that are unit-tested.
 */

export interface FindOptions {
  caseSensitive?: boolean;
}

export interface FindMatch {
  start: number;
  end: number;
}

/** Returns the offsets of every (non-overlapping) match of `query` in `text`. */
export function findMatches(text: string, query: string, options: FindOptions = {}): FindMatch[] {
  if (!query) {
    return [];
  }
  const haystack = options.caseSensitive ? text : text.toLowerCase();
  const needle = options.caseSensitive ? query : query.toLowerCase();
  const matches: FindMatch[] = [];
  let from = 0;
  for (;;) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) {
      break;
    }
    matches.push({ start: index, end: index + needle.length });
    from = index + needle.length;
  }
  return matches;
}

/** Replaces the single match at `matchIndex` with `replacement`. */
export function replaceMatch(
  text: string,
  query: string,
  matchIndex: number,
  replacement: string,
  options: FindOptions = {},
): string {
  const matches = findMatches(text, query, options);
  const match = matches[matchIndex];
  if (!match) {
    return text;
  }
  return text.slice(0, match.start) + replacement + text.slice(match.end);
}

/** Replaces every match of `query` with `replacement`. */
export function replaceAll(
  text: string,
  query: string,
  replacement: string,
  options: FindOptions = {},
): string {
  const matches = findMatches(text, query, options);
  if (matches.length === 0) {
    return text;
  }
  let result = "";
  let cursor = 0;
  for (const match of matches) {
    result += text.slice(cursor, match.start) + replacement;
    cursor = match.end;
  }
  result += text.slice(cursor);
  return result;
}
