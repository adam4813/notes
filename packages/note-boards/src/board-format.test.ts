import { describe, expect, it } from "vitest";
import {
  emptyBoard,
  newCardId,
  parseBoard,
  serializeBoard,
  type BoardModel,
  type RichCard,
} from "./board-format";

describe("board-format — new format", () => {
  it("round-trips an empty board", () => {
    const { model } = parseBoard(emptyBoard());
    const { model: reparsed } = parseBoard(serializeBoard(model));
    expect(reparsed.columns.map((c) => c.name)).toEqual(["Todo", "Doing", "Done"]);
    expect(reparsed.columns.every((c) => c.cards.length === 0)).toBe(true);
  });

  it("round-trips columns with card IDs", () => {
    const model: BoardModel = {
      columns: [
        { name: "Todo", cards: ["card-aaa", "card-bbb"] },
        { name: "Done", cards: ["card-ccc"] },
      ],
    };
    const { model: reparsed } = parseBoard(serializeBoard(model));
    expect(reparsed.columns[0].cards).toEqual(["card-aaa", "card-bbb"]);
    expect(reparsed.columns[1].cards).toEqual(["card-ccc"]);
  });

  it("handles column names with spaces", () => {
    const model: BoardModel = { columns: [{ name: "In Progress", cards: [] }] };
    const { model: reparsed } = parseBoard(serializeBoard(model));
    expect(reparsed.columns[0].name).toBe("In Progress");
  });

  it("produces a board with 3 default empty columns", () => {
    const { model } = parseBoard(emptyBoard());
    expect(model.columns.length).toBe(3);
    expect(model.columns.every((c) => c.cards.length === 0)).toBe(true);
  });
});

describe("board-format — old format migration", () => {
  const OLD_BOARD = `---\ntype: board\n---\n\n## Todo\n\n- [ ] First task\n- [x] Done task @2026-02-01\n\n## Done\n`;

  it("detects old format and returns migratedCards", () => {
    const { model, migratedCards } = parseBoard(OLD_BOARD);
    expect(migratedCards).toBeDefined();
    expect(migratedCards?.length).toBe(2);
    expect(model.columns[0].cards.length).toBe(2);
    expect(model.columns[1].cards.length).toBe(0);
  });

  it("migrated cards have correct fields", () => {
    const { migratedCards } = parseBoard(OLD_BOARD);
    const first = migratedCards?.[0] as RichCard;
    expect(first.title).toBe("First task");
    expect(first.done).toBe(false);
    expect(first.body).toBe("");
    const second = migratedCards?.[1] as RichCard;
    expect(second.done).toBe(true);
    expect(second.due).toBe("2026-02-01");
  });

  it("migrated card IDs are stored in columns", () => {
    const { model, migratedCards } = parseBoard(OLD_BOARD);
    const ids = migratedCards!.map((c) => c.id);
    expect(model.columns[0].cards).toEqual(ids);
  });

  it("new format produced by serializeBoard is NOT detected as old format", () => {
    const { model } = parseBoard(OLD_BOARD);
    const serialized = serializeBoard(model);
    const reparsed = parseBoard(serialized);
    expect(reparsed.migratedCards).toBeUndefined();
  });

  it("newCardId returns unique prefixed IDs", () => {
    const ids = Array.from({ length: 5 }, () => newCardId());
    const unique = new Set(ids);
    expect(unique.size).toBe(5);
    expect(ids.every((id) => id.startsWith("card-"))).toBe(true);
  });
});
