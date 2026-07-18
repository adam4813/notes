import {
  buildContent,
  getFrontmatterField,
  parseFrontmatter,
} from "@notes/web/src/lib/frontmatter";
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

const keyFields: (keyof RichCard)[] = ["title", "done", "due", "labels", "priority", "column"];

function serializeCard(card: RichCard): string {
  return buildContent(
    [...keyFields.map((key) => ({ key, value: card[key] })), ...(card.frontmatter ?? [])].filter(
      Boolean,
    ),
    card.body,
  );
}

function parseCardFile(id: string, content: string): RichCard {
  const parsed = parseFrontmatter(content);

  const dueStr = getFrontmatterField(parsed.props, "due");
  const priority = getFrontmatterField<RichCard["priority"]>(parsed.props, "priority");
  const labels = getFrontmatterField<string[]>(parsed.props, "labels");

  return {
    id,
    title: getFrontmatterField(parsed.props, "title") ?? id,
    column: getFrontmatterField(parsed.props, "column") ?? "",
    done: getFrontmatterField(parsed.props, "done") === "true",
    ...(dueStr ? { due: dueStr } : {}),
    ...(labels?.length ? { labels } : {}),
    ...(priority ? { priority } : {}),
    body: parsed.body,
    frontmatter: parsed.props.filter((prop) => !keyFields.includes(prop.key as keyof RichCard)),
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
