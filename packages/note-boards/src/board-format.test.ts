import { describe, expect, it } from "vitest";
import { emptyBoard, parseBoard, serializeBoard, type BoardModel } from "./board-format";

describe("board-format — new format", () => {
  it("round-trips an empty board", () => {
    const model = parseBoard(emptyBoard());
    const reparsed = parseBoard(serializeBoard(model));
    expect(reparsed.columns.map((c) => c.name)).toEqual(["Todo", "Doing", "Done"]);
    expect(reparsed.columns.every((c) => c.cards.length === 0)).toBe(true);
  });

  it("round-trips columns with card IDs", () => {
    const model: BoardModel = {
      frontmatter: [],
      columns: [
        { name: "Todo", cards: ["card-aaa", "card-bbb"] },
        { name: "Done", cards: ["card-ccc"] },
      ],
    };
    const reparsed = parseBoard(serializeBoard(model));
    expect(reparsed.columns[0].cards).toEqual(["card-aaa", "card-bbb"]);
    expect(reparsed.columns[1].cards).toEqual(["card-ccc"]);
  });

  it("handles column names with spaces", () => {
    const model: BoardModel = { frontmatter: [], columns: [{ name: "In Progress", cards: [] }] };
    const reparsed = parseBoard(serializeBoard(model));
    expect(reparsed.columns[0].name).toBe("In Progress");
  });

  it("produces a board with 3 default empty columns", () => {
    const model = parseBoard(emptyBoard());
    expect(model.columns.length).toBe(3);
    expect(model.columns.every((c) => c.cards.length === 0)).toBe(true);
  });
});
