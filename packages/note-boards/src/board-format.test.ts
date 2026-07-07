import { describe, expect, it } from "vitest";
import { emptyBoard, parseBoard, serializeBoard, type BoardModel } from "./board-format";

function strip(model: BoardModel) {
  return model.columns.map((column) => ({
    name: column.name,
    cards: column.cards.map((card) => ({ text: card.text, done: card.done })),
  }));
}

describe("board-format", () => {
  it("round-trips columns and cards", () => {
    const parsed = parseBoard(emptyBoard());
    const reparsed = parseBoard(serializeBoard(parsed));
    expect(strip(reparsed)).toEqual(strip(parsed));
  });

  it("parses checkbox state and column structure", () => {
    const parsed = parseBoard("---\ntype: board\n---\n\n## A\n\n- [x] done\n- [ ] todo\n\n## B\n");
    expect(parsed.columns.map((c) => c.name)).toEqual(["A", "B"]);
    expect(parsed.columns[0].cards.map((c) => [c.text, c.done])).toEqual([
      ["done", true],
      ["todo", false],
    ]);
    expect(parsed.columns[1].cards).toEqual([]);
  });

  it("produces a usable default board", () => {
    const parsed = parseBoard(emptyBoard());
    expect(parsed.columns.length).toBe(3);
    expect(parsed.columns[0].cards.length).toBeGreaterThan(0);
  });
});
