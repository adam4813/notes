import { describe, expect, it } from "vitest";
import { emptyTableMarkdown, parseTable, serializeTable, type TableModel } from "./table-format";

describe("table-format", () => {
  it("round-trips a model through serialize → parse", () => {
    const model: TableModel = {
      columns: [
        { name: "Task", type: "text" },
        { name: "Priority", type: "select", options: ["Low", "High"] },
        { name: "Done", type: "checkbox" },
      ],
      rows: [
        ["Write, spec", "High", "true"],
        ['Review "x"', "Low", "false"],
      ],
    };
    expect(parseTable(serializeTable(model))).toEqual(model);
  });

  it("preserves quoted commas in CSV cells", () => {
    const markdown = serializeTable({
      columns: [
        { name: "A", type: "text" },
        { name: "B", type: "text" },
      ],
      rows: [["x,y", "z"]],
    });
    expect(parseTable(markdown).rows[0]).toEqual(["x,y", "z"]);
  });

  it("derives columns from the CSV header when frontmatter has none", () => {
    const parsed = parseTable("```csv\nA,B\n1,2\n```");
    expect(parsed.columns.map((column) => column.name)).toEqual(["A", "B"]);
    expect(parsed.rows).toEqual([["1", "2"]]);
  });

  it("always yields at least one column", () => {
    expect(parseTable("no table here").columns.length).toBeGreaterThan(0);
  });

  it("produces a usable default table", () => {
    const parsed = parseTable(emptyTableMarkdown());
    expect(parsed.columns.length).toBeGreaterThan(0);
    expect(parsed.rows.length).toBeGreaterThan(0);
  });
});
