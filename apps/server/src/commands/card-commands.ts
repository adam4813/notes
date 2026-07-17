import type { CommandBus } from "@notes/core";
import type { RichCard } from "@notes/note-boards";
import { parseBoard, serializeBoard } from "@notes/note-boards";
import type { Tome } from "@notes/tome";
import { deleteCard, listCards, readCard, writeCard } from "./card-store";

interface GetTome {
  (): Tome;
}

async function readBoardModel(boardPath: string, tome: Tome) {
  const content = await tome.read(boardPath);
  return parseBoard(content);
}

async function saveBoardModel(
  boardPath: string,
  model: import("@notes/note-boards").BoardModel,
  tome: Tome,
): Promise<void> {
  await tome.write(boardPath, serializeBoard(model));
}

/**
 * Registers card CRUD commands. All commands receive `boardPath` (relative
 * tome path to the `.md` board file) and operate on the companion dot-folder.
 */
export function registerCardCommands(bus: CommandBus, getTome: GetTome): void {
  // ------------------------------------------------------------------
  // card.list — fetch all RichCards for a board, ordered by column layout
  // ------------------------------------------------------------------
  bus.register<{ boardPath: string }, { cards: RichCard[] }>({
    name: "card.list",
    handler: async ({ boardPath }) => {
      const tome = getTome();
      const model = await readBoardModel(boardPath, tome);
      const cards = await listCards(boardPath, tome);
      // Return in column order as defined by the board model
      const orderedIds = model.columns.flatMap((c) => c.cards);
      const byId = new Map(cards.map((c) => [c.id, c]));
      const ordered = orderedIds.map((id) => byId.get(id)).filter((c): c is RichCard => c != null);
      // Append any orphaned cards (not referenced in layout)
      const unref = cards.filter((c) => !orderedIds.includes(c.id));
      return { cards: [...ordered, ...unref] };
    },
  });

  // ------------------------------------------------------------------
  // card.get — fetch a single card
  // ------------------------------------------------------------------
  bus.register<{ boardPath: string; cardId: string }, RichCard>({
    name: "card.get",
    handler: async ({ boardPath, cardId }) => {
      return readCard(boardPath, cardId, getTome());
    },
  });

  // ------------------------------------------------------------------
  // card.create — create a new card in the given column
  // ------------------------------------------------------------------
  bus.register<{ boardPath: string; column: string }, RichCard>({
    name: "card.create",
    handler: async ({ boardPath, column }) => {
      const tome = getTome();
      const model = await readBoardModel(boardPath, tome);
      const { newCardId } = await import("@notes/note-boards");
      const id = newCardId();
      const card: RichCard = { id, title: "New card", column, done: false, body: "" };
      await writeCard(boardPath, card, tome);
      // Insert at end of target column
      const colIndex = model.columns.findIndex((c) => c.name === column);
      if (colIndex === -1) {
        model.columns.push({ name: column, cards: [id] });
      } else {
        model.columns[colIndex].cards.push(id);
      }
      await saveBoardModel(boardPath, model, tome);
      return card;
    },
  });

  // ------------------------------------------------------------------
  // card.update — write card content + update column/order if changed
  // ------------------------------------------------------------------
  bus.register<{ boardPath: string; card: RichCard }, RichCard>({
    name: "card.update",
    handler: async ({ boardPath, card }) => {
      const tome = getTome();
      await writeCard(boardPath, card, tome);
      // Update column placement if card.column changed
      const model = await readBoardModel(boardPath, tome);
      let changed = false;
      // Remove from old column(s)
      for (const col of model.columns) {
        const idx = col.cards.indexOf(card.id);
        if (idx !== -1 && col.name !== card.column) {
          col.cards.splice(idx, 1);
          changed = true;
        }
      }
      // Ensure it's in the target column
      const targetCol = model.columns.find((c) => c.name === card.column);
      if (targetCol && !targetCol.cards.includes(card.id)) {
        targetCol.cards.push(card.id);
        changed = true;
      }
      if (changed) {
        await saveBoardModel(boardPath, model, tome);
      }
      return card;
    },
  });

  // ------------------------------------------------------------------
  // card.delete — remove card file + remove from board layout
  // ------------------------------------------------------------------
  bus.register<{ boardPath: string; cardId: string }, { cardId: string }>({
    name: "card.delete",
    handler: async ({ boardPath, cardId }) => {
      const tome = getTome();
      await deleteCard(boardPath, cardId, tome);
      const model = await readBoardModel(boardPath, tome);
      for (const col of model.columns) {
        const idx = col.cards.indexOf(cardId);
        if (idx !== -1) {
          col.cards.splice(idx, 1);
        }
      }
      await saveBoardModel(boardPath, model, tome);
      return { cardId };
    },
  });

  // ------------------------------------------------------------------
  // card.move — reorder card within or between columns
  // ------------------------------------------------------------------
  bus.register<
    { boardPath: string; cardId: string; toColumn: string; toIndex: number },
    { cardId: string; toColumn: string; toIndex: number }
  >({
    name: "card.move",
    handler: async ({ boardPath, cardId, toColumn, toIndex }) => {
      const tome = getTome();
      const model = await readBoardModel(boardPath, tome);
      // Remove from all columns
      for (const col of model.columns) {
        const idx = col.cards.indexOf(cardId);
        if (idx !== -1) {
          col.cards.splice(idx, 1);
        }
      }
      // Insert into target column at index
      let targetCol = model.columns.find((c) => c.name === toColumn);
      if (!targetCol) {
        targetCol = { name: toColumn, cards: [] };
        model.columns.push(targetCol);
      }
      const clampedIdx = Math.max(0, Math.min(toIndex, targetCol.cards.length));
      targetCol.cards.splice(clampedIdx, 0, cardId);
      await saveBoardModel(boardPath, model, tome);
      // Update card's column frontmatter
      try {
        const card = await readCard(boardPath, cardId, tome);
        if (card.column !== toColumn) {
          await writeCard(boardPath, { ...card, column: toColumn }, tome);
        }
      } catch {
        // Card file may not exist for orphan IDs — ignore
      }
      return { cardId, toColumn, toIndex: clampedIdx };
    },
  });
}
