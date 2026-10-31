/**
 * Minimal line-based diff used by the version-history feature. Produces an
 * ordered list of rows (added / removed / unchanged) plus change counts, so the
 * same algorithm backs both the per-version change counts and the diff view.
 *
 * Kept dependency-free on purpose: the project convention is to avoid adding
 * libraries unless necessary, and a line LCS is small and easy to test.
 */

export type DiffRowType = "add" | "del" | "context";

export interface DiffRow {
  type: DiffRowType;
  text: string;
  /** 1-based line number in the old text (del / context rows). */
  oldLine?: number;
  /** 1-based line number in the new text (add / context rows). */
  newLine?: number;
}

export interface LineDiff {
  rows: DiffRow[];
  additions: number;
  deletions: number;
}

/**
 * Above this `oldLines * newLines` product we skip the quadratic LCS and emit a
 * plain block replacement. Keeps memory bounded for pathologically large files
 * while staying exact for normal notes.
 */
const LCS_CELL_CAP = 2_000_000;

/** Splits text into lines, ignoring a single trailing newline. */
export function toLines(text: string): string[] {
  if (text === "") {
    return [];
  }
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function blockReplace(oldLines: string[], newLines: string[]): LineDiff {
  const rows: DiffRow[] = [];
  oldLines.forEach((text, i) => rows.push({ type: "del", text, oldLine: i + 1 }));
  newLines.forEach((text, i) => rows.push({ type: "add", text, newLine: i + 1 }));
  return { rows, additions: newLines.length, deletions: oldLines.length };
}

/** Computes a line-level diff between two texts. */
export function lineDiff(oldText: string, newText: string): LineDiff {
  const oldLines = toLines(oldText);
  const newLines = toLines(newText);
  const n = oldLines.length;
  const m = newLines.length;

  if (n * m > LCS_CELL_CAP) {
    return blockReplace(oldLines, newLines);
  }

  // dp[i][j] = length of the LCS of oldLines[i:] and newLines[j:].
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        oldLines[i] === newLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let additions = 0;
  let deletions = 0;
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      rows.push({ type: "context", text: oldLines[i], oldLine: i + 1, newLine: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: "del", text: oldLines[i], oldLine: i + 1 });
      deletions++;
      i++;
    } else {
      rows.push({ type: "add", text: newLines[j], newLine: j + 1 });
      additions++;
      j++;
    }
  }
  while (i < n) {
    rows.push({ type: "del", text: oldLines[i], oldLine: i + 1 });
    deletions++;
    i++;
  }
  while (j < m) {
    rows.push({ type: "add", text: newLines[j], newLine: j + 1 });
    additions++;
    j++;
  }

  return { rows, additions, deletions };
}
