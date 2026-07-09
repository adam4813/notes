export interface RichCard {
  id: string;
  title: string;
  column: string;
  done: boolean;
  due?: string;
  labels?: string[];
  priority?: "low" | "medium" | "high";
  body: string;
}

export interface BoardColumn {
  name: string;
  /** Card IDs referencing files in the companion dot-folder. */
  cards: string[];
}

export interface BoardModel {
  columns: BoardColumn[];
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
const OLD_HEADING_RE = /^##\s+(.+?)\s*$/;
const OLD_CARD_RE = /^\s*-\s+(?:\[( |x|X)\]\s+)?(.+)$/;

let counter = 0;
export function newCardId(): string {
  counter += 1;
  return `card-${Date.now().toString(36)}-${counter}`;
}

function serializeBoardFrontmatter(model: BoardModel): string {
  const lines = ["type: board", "columns:"];
  for (const col of model.columns) {
    const safeName = col.name.includes('"') ? `'${col.name}'` : `"${col.name}"`;
    lines.push(`  - name: ${safeName}`);
    if (col.cards.length === 0) {
      lines.push(`    cards: []`);
    } else {
      lines.push(`    cards:`);
      for (const id of col.cards) {
        lines.push(`      - ${id}`);
      }
    }
  }
  return lines.join("\n");
}

function parseBoardFrontmatter(yaml: string): BoardModel | null {
  if (!yaml.includes("columns:")) {
    return null;
  }
  const columns: BoardColumn[] = [];
  let currentName: string | null = null;
  let currentCards: string[] = [];
  let inCardsList = false;
  for (const raw of yaml.split("\n")) {
    const line = raw.trimEnd();
    const nameMatch = /^  - name:\s*(.+)$/.exec(line);
    if (nameMatch) {
      if (currentName !== null) {
        columns.push({ name: currentName, cards: currentCards });
      }
      currentName = nameMatch[1].trim().replace(/^["'](.*)["']$/, "$1");
      currentCards = [];
      inCardsList = false;
      continue;
    }
    const inlineMatch = /^    cards:\s*\[([^\]]*)\]/.exec(line);
    if (inlineMatch) {
      currentCards = inlineMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      inCardsList = false;
      continue;
    }
    if (/^    cards:\s*$/.test(line)) {
      inCardsList = true;
      continue;
    }
    if (inCardsList) {
      const idMatch = /^      - (.+)$/.exec(line);
      if (idMatch) {
        currentCards.push(idMatch[1].trim());
      } else if (line && /^    [a-z]/.test(line)) {
        inCardsList = false;
      }
    }
  }
  if (currentName !== null) {
    columns.push({ name: currentName, cards: currentCards });
  }
  return columns.length > 0 ? { columns } : null;
}

/**
 * Parses a board file. If the file used the old markdown-backed format
 * (## headings + list items), `migratedCards` is populated with stub RichCards
 * that the server should persist to the dot-folder.
 */
export function parseBoard(markdown: string): { model: BoardModel; migratedCards?: RichCard[] } {
  const fm = FRONTMATTER_RE.exec(markdown);
  const yamlText = fm ? fm[1] : "";
  const body = fm ? markdown.slice(fm[0].length) : markdown;

  // New format: frontmatter has structured columns array.
  const newModel = parseBoardFrontmatter(yamlText);
  if (newModel) {
    return { model: newModel };
  }

  // Old format: ## headings + list-item cards → migrate.
  const columns: BoardColumn[] = [];
  const migratedCards: RichCard[] = [];
  let currentColIndex = -1;

  for (const line of body.split(/\r?\n/)) {
    const heading = OLD_HEADING_RE.exec(line);
    if (heading) {
      columns.push({ name: heading[1], cards: [] });
      currentColIndex = columns.length - 1;
      continue;
    }
    const cardMatch = OLD_CARD_RE.exec(line);
    if (cardMatch && currentColIndex >= 0) {
      let text = cardMatch[2].trim();
      if (!text) {
        continue;
      }
      let due: string | undefined;
      const dueMatch = /\s@(\d{4}-\d{2}-\d{2})$/.exec(text);
      if (dueMatch) {
        due = dueMatch[1];
        text = text.slice(0, dueMatch.index).trim();
      }
      const id = newCardId();
      const card: RichCard = {
        id,
        title: text,
        column: columns[currentColIndex].name,
        done: cardMatch[1]?.toLowerCase() === "x",
        body: "",
        ...(due ? { due } : {}),
      };
      columns[currentColIndex].cards.push(id);
      migratedCards.push(card);
    }
  }

  if (columns.length === 0) {
    columns.push({ name: "Todo", cards: [] });
    columns.push({ name: "Doing", cards: [] });
    columns.push({ name: "Done", cards: [] });
  }

  return {
    model: { columns },
    ...(migratedCards.length > 0 ? { migratedCards } : {}),
  };
}

export function serializeBoard(model: BoardModel): string {
  return `---\n${serializeBoardFrontmatter(model)}\n---\n`;
}

export function emptyBoard(): string {
  return serializeBoard({
    columns: [
      { name: "Todo", cards: [] },
      { name: "Doing", cards: [] },
      { name: "Done", cards: [] },
    ],
  });
}
