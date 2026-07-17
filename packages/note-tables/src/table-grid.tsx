import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { PopupMenu } from "@notes/ui";
import { NoteToolbar, usePromptDialog } from "@notes/editor";
import {
  COLUMN_TYPES,
  parseTable,
  serializeTable,
  type ColumnType,
  type TableModel,
} from "./table-format";

interface TableGridProps {
  value: string;
  onChange: (markdown: string) => void;
}

interface CellPos {
  r: number;
  c: number;
}

function cloneRows(rows: string[][]): string[][] {
  return rows.map((row) => row.slice());
}

function compareValues(a: string, b: string, type: ColumnType): number {
  if (type === "number") {
    return (Number(a) || 0) - (Number(b) || 0);
  }
  return a.localeCompare(b);
}

export function TableGrid({ value, onChange }: TableGridProps) {
  const { openPrompt, promptDialog } = usePromptDialog();
  const [model, setModel] = useState<TableModel>(() => parseTable(value));
  const lastSerialized = useRef(value);
  const [sel, setSel] = useState<CellPos>({ r: 0, c: 0 });
  const [editing, setEditing] = useState<CellPos | null>(null);
  const [draft, setDraft] = useState("");
  const [menuCol, setMenuCol] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== lastSerialized.current) {
      setModel(parseTable(value));
      lastSerialized.current = value;
    }
  }, [value]);

  const commit = useCallback(
    (next: TableModel) => {
      setModel(next);
      const markdown = serializeTable(next);
      lastSerialized.current = markdown;
      onChange(markdown);
    },
    [onChange],
  );

  const setCell = useCallback(
    (r: number, c: number, cellValue: string) => {
      const rows = cloneRows(model.rows);
      if (!rows[r]) {
        return;
      }
      rows[r][c] = cellValue;
      commit({ ...model, rows });
    },
    [commit, model],
  );

  const columnCount = model.columns.length;
  const rowCount = model.rows.length;

  const clampSel = useCallback(
    (pos: CellPos): CellPos => ({
      r: Math.max(0, Math.min(pos.r, rowCount - 1)),
      c: Math.max(0, Math.min(pos.c, columnCount - 1)),
    }),
    [rowCount, columnCount],
  );

  const startEdit = useCallback(
    (pos: CellPos, initial?: string) => {
      setEditing(pos);
      setDraft(initial ?? model.rows[pos.r]?.[pos.c] ?? "");
    },
    [model.rows],
  );

  const commitEdit = useCallback(
    (advance: "down" | "right" | null) => {
      if (!editing) {
        return;
      }
      setCell(editing.r, editing.c, draft);
      setEditing(null);
      if (advance === "down") {
        setSel(clampSel({ r: editing.r + 1, c: editing.c }));
      } else if (advance === "right") {
        setSel(clampSel({ r: editing.r, c: editing.c + 1 }));
      }
      gridRef.current?.focus();
    },
    [editing, draft, setCell, clampSel],
  );

  const addRow = useCallback(() => {
    const rows = cloneRows(model.rows);
    rows.push(new Array<string>(columnCount).fill(""));
    commit({ ...model, rows });
    setSel({ r: rows.length - 1, c: 0 });
  }, [commit, model, columnCount]);

  const addColumn = useCallback(() => {
    const columns = [
      ...model.columns,
      { name: `Column ${columnCount + 1}`, type: "text" as ColumnType },
    ];
    const rows = model.rows.map((row) => [...row, ""]);
    commit({ ...model, columns, rows });
  }, [commit, model, columnCount]);

  const deleteRow = useCallback(
    (r: number) => {
      const rows = model.rows.filter((_, index) => index !== r);
      commit({ ...model, rows });
      setSel((prev) => clampSel({ r: Math.min(prev.r, rows.length - 1), c: prev.c }));
    },
    [commit, model, clampSel],
  );

  const deleteColumn = useCallback(
    (c: number) => {
      if (columnCount <= 1) {
        return;
      }
      const columns = model.columns.filter((_, index) => index !== c);
      const rows = model.rows.map((row) => row.filter((_, index) => index !== c));
      commit({ ...model, columns, rows });
      setMenuCol(null);
    },
    [commit, model, columnCount],
  );

  const renameColumn = useCallback(
    async (c: number) => {
      const current = model.columns[c];
      const values = await openPrompt({
        title: "Rename column",
        fields: [{ key: "name", label: "Column name", defaultValue: current.name, required: true }],
        confirmLabel: "Rename",
      });
      if (!values) {
        return;
      }
      const name = values.name;
      const columns = model.columns.map((column, index) =>
        index === c ? { ...column, name: name.trim() || column.name } : column,
      );
      commit({ ...model, columns });
      setMenuCol(null);
    },
    [commit, model, openPrompt],
  );

  const setColumnType = useCallback(
    async (c: number, type: ColumnType) => {
      const current = model.columns[c];
      let selectOptions: string[] | undefined = current.options;
      if (type === "select" && !selectOptions) {
        const values = await openPrompt({
          title: "Select options",
          description: "Comma-separated options for this column.",
          fields: [
            {
              key: "options",
              label: "Options",
              defaultValue: "Todo, Doing, Done",
              required: true,
            },
          ],
          confirmLabel: "Set options",
        });
        if (!values) {
          return;
        }
        selectOptions = values.options
          .split(",")
          .map((option) => option.trim())
          .filter(Boolean);
      }
      const columns = model.columns.map((column, index) => {
        if (index !== c) {
          return column;
        }
        const next = { ...column, type };
        if (type === "select") {
          next.options = selectOptions;
        }
        return next;
      });
      commit({ ...model, columns });
      setMenuCol(null);
    },
    [commit, model, openPrompt],
  );

  const editColumnOptions = useCallback(
    async (c: number) => {
      const current = model.columns[c];
      const values = await openPrompt({
        title: "Edit options",
        fields: [
          {
            key: "options",
            label: "Options (comma-separated)",
            defaultValue: (current.options ?? []).join(", "),
            required: true,
          },
        ],
        confirmLabel: "Save",
      });
      if (!values) {
        return;
      }
      const options = values.options
        .split(",")
        .map((option) => option.trim())
        .filter(Boolean);
      const columns = model.columns.map((column, index) =>
        index === c ? { ...column, options } : column,
      );
      commit({ ...model, columns });
      setMenuCol(null);
    },
    [commit, model, openPrompt],
  );

  const sortByColumn = useCallback(
    (c: number, direction: "asc" | "desc") => {
      const type = model.columns[c].type;
      const rows = cloneRows(model.rows).sort((a, b) => {
        const result = compareValues(a[c] ?? "", b[c] ?? "", type);
        return direction === "asc" ? result : -result;
      });
      commit({ ...model, rows });
      setMenuCol(null);
    },
    [commit, model],
  );

  const onGridKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (editing) {
        return;
      }
      const { key } = event;
      if (key === "ArrowUp") {
        event.preventDefault();
        setSel((prev) => clampSel({ r: prev.r - 1, c: prev.c }));
      } else if (key === "ArrowDown") {
        event.preventDefault();
        setSel((prev) => clampSel({ r: prev.r + 1, c: prev.c }));
      } else if (key === "ArrowLeft") {
        event.preventDefault();
        setSel((prev) => clampSel({ r: prev.r, c: prev.c - 1 }));
      } else if (key === "ArrowRight" || key === "Tab") {
        event.preventDefault();
        setSel((prev) => clampSel({ r: prev.r, c: prev.c + 1 }));
      } else if (key === "Enter" || key === "F2") {
        event.preventDefault();
        startEdit(sel);
      } else if (key === "Delete" || key === "Backspace") {
        event.preventDefault();
        setCell(sel.r, sel.c, "");
      } else if (key === "c" && (event.ctrlKey || event.metaKey)) {
        void navigator.clipboard?.writeText(model.rows[sel.r]?.[sel.c] ?? "");
      } else if (key === "v" && (event.ctrlKey || event.metaKey)) {
        void navigator.clipboard?.readText().then((text) => setCell(sel.r, sel.c, text.trim()));
      } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        startEdit(sel, key);
      }
    },
    [editing, clampSel, sel, startEdit, setCell, model.rows],
  );

  const renderCell = (r: number, c: number) => {
    const column = model.columns[c];
    const cellValue = model.rows[r]?.[c] ?? "";
    const isEditing = editing?.r === r && editing.c === c;

    if (column.type === "checkbox") {
      return (
        <input
          type="checkbox"
          checked={cellValue === "true"}
          onChange={() => setCell(r, c, cellValue === "true" ? "false" : "true")}
        />
      );
    }

    if (column.type === "select") {
      const options = column.options ?? [];
      const known = cellValue === "" || options.includes(cellValue);
      return (
        <select
          className="grid-select"
          value={cellValue}
          onChange={(event) => setCell(r, c, event.target.value)}
        >
          <option value="" />
          {!known && <option value={cellValue}>{cellValue}</option>}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (isEditing) {
      return (
        <input
          autoFocus
          className="grid-input"
          type={column.type === "number" ? "number" : column.type === "date" ? "date" : "text"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commitEdit(null)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitEdit("down");
            } else if (event.key === "Tab") {
              event.preventDefault();
              commitEdit("right");
            } else if (event.key === "Escape") {
              event.preventDefault();
              setEditing(null);
            }
          }}
        />
      );
    }

    return <span className={`grid-value grid-value--${column.type}`}>{cellValue}</span>;
  };

  return (
    <>
      <div className="table-note">
        <NoteToolbar
          label="Table tools"
          className="table-toolbar"
          trailing={
            <span className="table-meta">
              {rowCount} rows · {columnCount} columns
            </span>
          }
        >
          <button className="tb-btn" onClick={addRow}>
            ＋ Row
          </button>
          <button className="tb-btn" onClick={addColumn}>
            ＋ Column
          </button>
        </NoteToolbar>
        <div
          className="table-scroll"
          ref={gridRef}
          tabIndex={0}
          role="grid"
          onKeyDown={onGridKeyDown}
        >
          <table className="data-grid">
            <thead>
              <tr>
                <th className="grid-gutter" />
                {model.columns.map((column, c) => (
                  <th key={c} className="grid-head">
                    <div className="grid-head-inner">
                      <span className="grid-head-name" title={`${column.name} (${column.type})`}>
                        {column.name}
                      </span>
                      <PopupMenu
                        open={menuCol === c}
                        onClose={() => setMenuCol(null)}
                        menu={
                          <>
                            <button onClick={() => void renameColumn(c)}>Rename…</button>
                            <button onClick={() => sortByColumn(c, "asc")}>Sort ascending</button>
                            <button onClick={() => sortByColumn(c, "desc")}>Sort descending</button>
                            <div className="grid-menu-label">Type</div>
                            {COLUMN_TYPES.map((type) => (
                              <button
                                key={type}
                                className={type === column.type ? "grid-menu-active" : ""}
                                onClick={() => void setColumnType(c, type)}
                              >
                                {type}
                              </button>
                            ))}
                            {column.type === "select" && (
                              <button onClick={() => void editColumnOptions(c)}>
                                Edit options…
                              </button>
                            )}
                            <button className="grid-menu-danger" onClick={() => deleteColumn(c)}>
                              Delete column
                            </button>
                          </>
                        }
                      >
                        <button
                          className="grid-head-menu"
                          aria-label={`Options for ${column.name}`}
                          onClick={() => setMenuCol((prev) => (prev === c ? null : c))}
                        >
                          ▾
                        </button>
                      </PopupMenu>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row, r) => (
                <tr key={r}>
                  <td className="grid-gutter">
                    <span className="grid-rownum">{r + 1}</span>
                    <button
                      className="grid-row-delete"
                      aria-label={`Delete row ${r + 1}`}
                      onClick={() => deleteRow(r)}
                    >
                      ×
                    </button>
                  </td>
                  {row.map((_cell, c) => (
                    <td
                      key={c}
                      className={`table-grid-cell ${sel.r === r && sel.c === c ? "grid-cell--selected" : ""}`}
                      onMouseDown={() => setSel({ r, c })}
                      onDoubleClick={() => startEdit({ r, c })}
                    >
                      {renderCell(r, c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {promptDialog}
    </>
  );
}
