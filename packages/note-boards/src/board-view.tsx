import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  newCardId,
  parseBoard,
  serializeBoard,
  type BoardColumn,
  type BoardModel,
} from "./board-format";

interface BoardViewProps {
  value: string;
  onChange: (markdown: string) => void;
}

interface CardDrag {
  cardId: string;
  fromColumn: number;
}

export function BoardView({ value, onChange }: BoardViewProps) {
  const [model, setModel] = useState<BoardModel>(() => parseBoard(value));
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState<number | null>(null);
  const [addDraft, setAddDraft] = useState("");
  const lastSerialized = useRef(value);

  useEffect(() => {
    if (value !== lastSerialized.current) {
      setModel(parseBoard(value));
      lastSerialized.current = value;
    }
  }, [value]);

  const commit = (columns: BoardColumn[]) => {
    const next = { ...model, columns };
    setModel(next);
    const markdown = serializeBoard(next);
    lastSerialized.current = markdown;
    onChange(markdown);
  };

  const mapColumn = (index: number, fn: (column: BoardColumn) => BoardColumn) =>
    commit(model.columns.map((column, i) => (i === index ? fn(column) : column)));

  const toggleCard = (col: number, cardId: string) =>
    mapColumn(col, (column) => ({
      ...column,
      cards: column.cards.map((card) =>
        card.id === cardId ? { ...card, done: !card.done } : card,
      ),
    }));

  const setCardText = (col: number, cardId: string, text: string) =>
    mapColumn(col, (column) => ({
      ...column,
      cards: column.cards.map((card) => (card.id === cardId ? { ...card, text } : card)),
    }));

  const deleteCard = (col: number, cardId: string) =>
    mapColumn(col, (column) => ({
      ...column,
      cards: column.cards.filter((card) => card.id !== cardId),
    }));

  const addCard = (col: number, text: string) => {
    if (!text.trim()) {
      return;
    }
    mapColumn(col, (column) => ({
      ...column,
      cards: [...column.cards, { id: newCardId(), text: text.trim(), done: false }],
    }));
  };

  const moveCard = (drag: CardDrag, toColumn: number) => {
    if (drag.fromColumn === toColumn) {
      return;
    }
    const card = model.columns[drag.fromColumn]?.cards.find((c) => c.id === drag.cardId);
    if (!card) {
      return;
    }
    commit(
      model.columns.map((column, i) => {
        if (i === drag.fromColumn) {
          return { ...column, cards: column.cards.filter((c) => c.id !== drag.cardId) };
        }
        if (i === toColumn) {
          return { ...column, cards: [...column.cards, card] };
        }
        return column;
      }),
    );
  };

  const addColumn = () => {
    const name = window.prompt("Column name", "New column");
    if (name) {
      commit([...model.columns, { name, cards: [] }]);
    }
  };

  const renameColumn = (index: number) => {
    const name = window.prompt("Rename column", model.columns[index].name);
    if (name) {
      mapColumn(index, (column) => ({ ...column, name }));
    }
  };

  const deleteColumn = (index: number) => {
    if (window.confirm(`Delete column "${model.columns[index].name}" and its cards?`)) {
      commit(model.columns.filter((_, i) => i !== index));
    }
  };

  const onDropCard = (event: DragEvent, toColumn: number) => {
    event.preventDefault();
    try {
      const drag = JSON.parse(event.dataTransfer.getData("application/x-board-card")) as CardDrag;
      moveCard(drag, toColumn);
    } catch {
      // ignore malformed drag payloads
    }
  };

  return (
    <div className="board-note">
      <div className="board-scroll">
        {model.columns.map((column, colIndex) => (
          <section
            key={colIndex}
            className="board-column"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDropCard(event, colIndex)}
          >
            <header className="board-column-head">
              <span className="board-column-name" onDoubleClick={() => renameColumn(colIndex)}>
                {column.name}
              </span>
              <span className="board-column-count">{column.cards.length}</span>
              <button
                className="board-column-del"
                aria-label={`Delete column ${column.name}`}
                onClick={() => deleteColumn(colIndex)}
              >
                ×
              </button>
            </header>

            <div className="board-cards">
              {column.cards.map((card) => (
                <div
                  key={card.id}
                  className={`board-card ${card.done ? "board-card--done" : ""}`}
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData(
                      "application/x-board-card",
                      JSON.stringify({ cardId: card.id, fromColumn: colIndex }),
                    )
                  }
                >
                  <input
                    type="checkbox"
                    checked={card.done}
                    onChange={() => toggleCard(colIndex, card.id)}
                  />
                  {editing === card.id ? (
                    <input
                      autoFocus
                      className="board-card-input"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={() => {
                        setCardText(colIndex, card.id, draft.trim() || card.text);
                        setEditing(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        } else if (event.key === "Escape") {
                          setEditing(null);
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="board-card-text"
                      onDoubleClick={() => {
                        setEditing(card.id);
                        setDraft(card.text);
                      }}
                    >
                      {card.text}
                    </span>
                  )}
                  <button
                    className="board-card-del"
                    aria-label="Delete card"
                    onClick={() => deleteCard(colIndex, card.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {adding === colIndex ? (
              <input
                autoFocus
                className="board-add-input"
                placeholder="Card text…"
                value={addDraft}
                onChange={(event) => setAddDraft(event.target.value)}
                onBlur={() => {
                  addCard(colIndex, addDraft);
                  setAddDraft("");
                  setAdding(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addCard(colIndex, addDraft);
                    setAddDraft("");
                  } else if (event.key === "Escape") {
                    setAddDraft("");
                    setAdding(null);
                  }
                }}
              />
            ) : (
              <button className="board-add-card" onClick={() => setAdding(colIndex)}>
                ＋ Add card
              </button>
            )}
          </section>
        ))}

        <button className="board-add-column" onClick={addColumn}>
          ＋ Add column
        </button>
      </div>
    </div>
  );
}
