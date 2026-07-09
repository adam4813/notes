import { basename } from "node:path";
import { readdir } from "node:fs/promises";
import { posix } from "node:path";
import type { Tome } from "@notes/tome";
import type { RichCard } from "@notes/note-boards";

/** Returns the dot-folder path for a board's card files (relative to tome root). */
export function cardDotFolder(boardPath: string): string {
  const dir = posix.dirname(boardPath);
  const base = posix.basename(boardPath, ".md");
  const folder = `.${base}.cards`;
  return dir === "." ? folder : `${dir}/${folder}`;
}

export function cardFilePath(boardPath: string, cardId: string): string {
  return `${cardDotFolder(boardPath)}/${cardId}.md`;
}

function serializeCard(card: RichCard): string {
  const lines: string[] = ["---"];
  lines.push(`title: ${JSON.stringify(card.title)}`);
  lines.push(`column: ${JSON.stringify(card.column)}`);
  lines.push(`done: ${card.done}`);
  if (card.due) {
    lines.push(`due: "${card.due}"`);
  }
  if (card.labels && card.labels.length > 0) {
    lines.push(`labels: [${card.labels.map((l) => JSON.stringify(l)).join(", ")}]`);
  }
  if (card.priority) {
    lines.push(`priority: "${card.priority}"`);
  }
  lines.push("---");
  if (card.body) {
    lines.push("", card.body);
  }
  return lines.join("\n");
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---(?:\n|$)/;

function parseCardFile(id: string, content: string): RichCard {
  const fm = FRONTMATTER_RE.exec(content);
  const yaml = fm ? fm[1] : "";
  const body = fm ? content.slice(fm[0].length).trimStart() : content;

  const get = (key: string): string | undefined => {
    const m = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(yaml);
    if (!m) return undefined;
    return m[1].trim().replace(/^["'](.*)["']$/, "$1");
  };

  const getArr = (key: string): string[] => {
    const m = new RegExp(`^${key}:\\s*\\[([^\\]]*)\\]`, "m").exec(yaml);
    if (!m) return [];
    return m[1]
      .split(",")
      .map((s) => s.trim().replace(/^["'](.*)["']$/, "$1"))
      .filter(Boolean);
  };

  const doneStr = get("done");
  const priority = get("priority") as RichCard["priority"] | undefined;

  return {
    id,
    title: get("title") ?? id,
    column: get("column") ?? "",
    done: doneStr === "true",
    body,
    ...(get("due") ? { due: get("due") } : {}),
    ...(getArr("labels").length > 0 ? { labels: getArr("labels") } : {}),
    ...(priority ? { priority } : {}),
  };
}

export async function readCard(boardPath: string, cardId: string, tome: Tome): Promise<RichCard> {
  const content = await tome.read(cardFilePath(boardPath, cardId));
  return parseCardFile(cardId, content);
}

export async function writeCard(boardPath: string, card: RichCard, tome: Tome): Promise<void> {
  const folder = cardDotFolder(boardPath);
  await tome.mkdir(folder);
  await tome.write(cardFilePath(boardPath, card.id), serializeCard(card));
}

export async function deleteCard(boardPath: string, cardId: string, tome: Tome): Promise<void> {
  const filePath = cardFilePath(boardPath, cardId);
  if (await tome.exists(filePath)) {
    await tome.delete(filePath);
  }
}

export async function listCards(boardPath: string, tome: Tome): Promise<RichCard[]> {
  const folder = cardDotFolder(boardPath);
  if (!(await tome.exists(folder))) {
    return [];
  }
  let entries: string[];
  try {
    entries = await readdir(tome.resolve(folder));
  } catch {
    return [];
  }
  const cards: RichCard[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const id = basename(entry, ".md");
    try {
      cards.push(await readCard(boardPath, id, tome));
    } catch {
      // Skip unreadable card files
    }
  }
  return cards;
}
