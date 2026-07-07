export interface BoardCard {
  id: string;
  text: string;
  done: boolean;
}

export interface BoardColumn {
  name: string;
  cards: BoardCard[];
}

export interface BoardModel {
  frontmatter: string;
  columns: BoardColumn[];
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
const HEADING_RE = /^##\s+(.+?)\s*$/;
const CARD_RE = /^\s*-\s+(?:\[( |x|X)\]\s+)?(.*)$/;

let counter = 0;
export function newCardId(): string {
  counter += 1;
  return `card-${Date.now().toString(36)}-${counter}`;
}

/** Parses a markdown-backed kanban board (## columns, list-item cards). */
export function parseBoard(markdown: string): BoardModel {
  let frontmatter = "type: board";
  let body = markdown;
  const fm = FRONTMATTER_RE.exec(markdown);
  if (fm) {
    frontmatter = fm[1];
    body = markdown.slice(fm[0].length);
  }

  const columns: BoardColumn[] = [];
  let current: BoardColumn | null = null;
  for (const line of body.split(/\r?\n/)) {
    const heading = HEADING_RE.exec(line);
    if (heading) {
      current = { name: heading[1], cards: [] };
      columns.push(current);
      continue;
    }
    const card = CARD_RE.exec(line);
    if (card && current) {
      const text = card[2].trim();
      if (!text) {
        continue;
      }
      current.cards.push({ id: newCardId(), text, done: card[1]?.toLowerCase() === "x" });
    }
  }

  return { frontmatter, columns };
}

export function serializeBoard(model: BoardModel): string {
  const body = model.columns
    .map((column) => {
      const cards = column.cards
        .map((card) => `- [${card.done ? "x" : " "}] ${card.text}`)
        .join("\n");
      return `## ${column.name}\n\n${cards}${cards ? "\n" : ""}`;
    })
    .join("\n");
  return `---\n${model.frontmatter}\n---\n\n${body}`;
}

export function emptyBoard(): string {
  return serializeBoard({
    frontmatter: "type: board",
    columns: [
      { name: "Todo", cards: [{ id: newCardId(), text: "First task", done: false }] },
      { name: "Doing", cards: [] },
      { name: "Done", cards: [] },
    ],
  });
}
