import { resolve, sep } from "node:path";

export class PathEscapeError extends Error {
  constructor(public readonly requestedPath: string) {
    super(`Path "${requestedPath}" escapes the Tome root`);
    this.name = "PathEscapeError";
  }
}

/**
 * Resolves a relative path against the Tome root, rejecting any result that
 * would land outside the root (via `..` segments or an absolute path).
 */
export function resolveWithinRoot(root: string, relativePath: string): string {
  const normalizedRoot = resolve(root);
  const target = resolve(normalizedRoot, relativePath);

  if (target !== normalizedRoot && !target.startsWith(normalizedRoot + sep)) {
    throw new PathEscapeError(relativePath);
  }

  return target;
}
