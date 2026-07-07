import Papa from "papaparse";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export type ColumnType = "text" | "number" | "date" | "checkbox" | "select";

export const COLUMN_TYPES: ColumnType[] = ["text", "number", "date", "checkbox", "select"];

export interface TableColumn {
  name: string;
  type: ColumnType;
  options?: string[];
}

export interface TableModel {
  columns: TableColumn[];
  /** Row-major cells; each row aligns to `columns`, values stored as strings. */
  rows: string[][];
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
const CSV_BLOCK_RE = /```csv\n([\s\S]*?)```/;

function normalizeRow(row: string[], width: number): string[] {
  const next = row.slice(0, width);
  while (next.length < width) {
    next.push("");
  }
  return next;
}

function sanitizeColumn(raw: unknown, index: number): TableColumn {
  const value = (raw ?? {}) as Partial<TableColumn>;
  const type = COLUMN_TYPES.includes(value.type as ColumnType) ? (value.type as ColumnType) : "text";
  const column: TableColumn = {
    name: typeof value.name === "string" && value.name.trim() ? value.name : `Column ${index + 1}`,
    type,
  };
  if (type === "select" && Array.isArray(value.options)) {
    column.options = value.options.filter((option): option is string => typeof option === "string");
  }
  return column;
}

/** Parses a table note (frontmatter schema + embedded CSV) into a model. */
export function parseTable(markdown: string): TableModel {
  let columns: TableColumn[] = [];
  let body = markdown;

  const frontmatter = FRONTMATTER_RE.exec(markdown);
  if (frontmatter) {
    const data = (parseYaml(frontmatter[1]) ?? {}) as { columns?: unknown[] };
    if (Array.isArray(data.columns)) {
      columns = data.columns.map((column, index) => sanitizeColumn(column, index));
    }
    body = markdown.slice(frontmatter[0].length);
  }

  const csv = CSV_BLOCK_RE.exec(body);
  const csvText = (csv ? csv[1] : "").trim();

  let rows: string[][] = [];
  if (csvText) {
    const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
    const records = parsed.data;
    if (records.length > 0) {
      if (columns.length === 0) {
        columns = records[0].map((name, index) => sanitizeColumn({ name, type: "text" }, index));
      }
      rows = records.slice(1).map((row) => normalizeRow(row, columns.length));
    }
  }

  if (columns.length === 0) {
    columns = [sanitizeColumn({ name: "Column 1", type: "text" }, 0)];
  }

  return { columns, rows };
}

/** Serializes a table model back to a table note (frontmatter + CSV block). */
export function serializeTable(model: TableModel): string {
  const header = model.columns.map((column) => column.name);
  const csv = Papa.unparse([header, ...model.rows]);
  const frontmatter = stringifyYaml({ type: "table", columns: model.columns }).trimEnd();
  return `---\n${frontmatter}\n---\n\n\`\`\`csv\n${csv}\n\`\`\`\n`;
}

/** Returns the default markdown for a brand-new table note. */
export function emptyTableMarkdown(): string {
  return serializeTable({
    columns: [
      { name: "Name", type: "text" },
      { name: "Status", type: "select", options: ["Todo", "Doing", "Done"] },
      { name: "Done", type: "checkbox" },
    ],
    rows: [
      ["First item", "Todo", "false"],
      ["Second item", "Doing", "false"],
    ],
  });
}
