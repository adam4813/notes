/**
 * Small subsequence fuzzy matcher for the command palette and quick switcher.
 * Returns a score (higher is better) and the matched character indices for
 * optional highlighting, or `null` when the query is not a subsequence.
 */

export interface FuzzyMatch {
  score: number;
  indices: number[];
}

/** Scores how well `query` fuzzy-matches `text`. Empty query matches all. */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return { score: 0, indices: [] };
  }
  const haystack = text.toLowerCase();

  const indices: number[] = [];
  let score = 0;
  let textIndex = 0;
  let prevMatch = -2;

  for (const char of needle) {
    let found = -1;
    for (let i = textIndex; i < haystack.length; i += 1) {
      if (haystack[i] === char) {
        found = i;
        break;
      }
    }
    if (found === -1) {
      return null;
    }

    // Reward consecutive matches and matches at word boundaries.
    if (found === prevMatch + 1) {
      score += 8;
    }
    if (found === 0 || /[\s/_\-.]/.test(text[found - 1] ?? "")) {
      score += 6;
    }
    // Slight penalty for gaps so earlier, tighter matches rank higher.
    score += Math.max(0, 4 - (found - textIndex));

    indices.push(found);
    prevMatch = found;
    textIndex = found + 1;
  }

  // Prefer shorter targets on ties.
  score += Math.max(0, 10 - Math.floor(text.length / 8));
  return { score, indices };
}

export interface FuzzyRanked<T> {
  item: T;
  score: number;
  indices: number[];
}

/**
 * Filters and ranks `items` by fuzzy-matching `key(item)` against `query`,
 * best first. With an empty query the original order is preserved.
 */
export function fuzzyRank<T>(
  query: string,
  items: T[],
  key: (item: T) => string,
): FuzzyRanked<T>[] {
  const ranked: FuzzyRanked<T>[] = [];
  items.forEach((item, order) => {
    const match = fuzzyMatch(query, key(item));
    if (match) {
      // Encode original order to keep a stable sort on ties.
      ranked.push({ item, score: match.score * 1000 - order, indices: match.indices });
    }
  });
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
