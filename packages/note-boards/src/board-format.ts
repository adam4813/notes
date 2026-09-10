import {
  buildContent,
  FrontmatterProp,
  getFrontmatterField,
  parseFrontmatter,
} from "@notes/web/src/lib/frontmatter";

/** Returns the companion dot-folder for a board's card files (relative to tome root). */
export function cardDotFolder(boardPath: string): string {
  const lastSlash = boardPath.lastIndexOf("/");
  const dir = lastSlash !== -1 ? boardPath.slice(0, lastSlash + 1) : "";
  const filename = lastSlash !== -1 ? boardPath.slice(lastSlash + 1) : boardPath;
  const base = filename.endsWith(".md") ? filename.slice(0, -3) : filename;
  return `${dir}.${base}.cards`;
}

/** Returns the file path for a single card within a board (relative to tome root). */
export function cardFilePath(boardPath: string, cardId: string): string {
  return `${cardDotFolder(boardPath)}/${cardId}.md`;
}

export interface RichCard {
  id: string;
  title: string;
  column: string;
  done: boolean;
  due?: string;
  labels?: string[];
  priority?: "low" | "medium" | "high";
  body: string;
  frontmatter?: FrontmatterProp[];
}

export interface IBoardColumn {
  name: string;
  /** Card IDs referencing files in the companion dot-folder. */
  cards: string[];
}

export interface BoardModel {
  frontmatter: FrontmatterProp[];
  columns: IBoardColumn[];
}

let counter = 0;
export function newCardId(): string {
  counter += 1;
  return `card-${Date.now().toString(36)}-${counter}`;
}

/**
 * Parses a board file. If the file used the old markdown-backed format
 * (## headings + list items), `migratedCards` is populated with stub RichCards
 * that the server should persist to the dot-folder.
 */
export function parseBoard(markdown: string): BoardModel {
  const parsed = parseFrontmatter(markdown);
  const columns = getFrontmatterField<IBoardColumn[]>(parsed.props, "columns") ?? [];

  if (columns.length === 0) {
    columns.push({ name: "Todo", cards: [] });
    columns.push({ name: "Doing", cards: [] });
    columns.push({ name: "Done", cards: [] });
  }

  return {
    frontmatter: parsed.props.length
      ? parsed.props.filter((prop) => prop.key !== "columns")
      : [{ key: "type", value: "board" }],
    columns,
  };
}

export function serializeBoard(model: BoardModel): string {
  return buildContent(
    [
      { key: "type", value: "board" },
      { key: "columns", value: model.columns },
      ...model.frontmatter,
    ],
    "",
  );
}

export function emptyBoard(): string {
  return serializeBoard({
    frontmatter: [{ key: "type", value: "board" }],
    columns: [
      { name: "Todo", cards: [] },
      { name: "Doing", cards: [] },
      { name: "Done", cards: [] },
    ],
  });
}
