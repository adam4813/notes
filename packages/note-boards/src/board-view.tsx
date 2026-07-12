import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { usePromptDialog } from "@notes/editor";
import { BoardCard } from "./board-card";
import { type BoardColumn, parseBoard, type RichCard, serializeBoard } from "./board-format";

interface BoardViewProps {
  value: string;
  onChange: (markdown: string) => void;
  path: string;
  onOpenWikilink?: (name: string) => void;
}

interface CardDrag {
  cardId: string;
  fromColumn: string;
}

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function BoardView({ value, onChange, path, onOpenWikilink }: BoardViewProps) {
  const { openPrompt, promptDialog } = usePromptDialog();
  const [columns, setColumns] = useState<BoardColumn[]>(() => parseBoard(value).model.columns);
  const [cards, setCards] = useState<Map<string, RichCard>>(new Map());
  const [addingCol, setAddingCol] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lastValue = useRef(value);
  const dragRef = useRef<CardDrag | null>(null);

  // Sync columns when value changes from external edit (file watcher).
  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value;
      setColumns(parseBoard(value).model.columns);
    }
  }, [value]);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cards?boardPath=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as { cards: RichCard[] };
      setCards(new Map(data.cards.map((c) => [c.id, c])));
      // Re-read board file to pick up any migration changes
      const fileRes = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
      if (fileRes.ok) {
        const fileData = (await fileRes.json()) as { content: string };
        const { model } = parseBoard(fileData.content);
        setColumns(model.columns);
        lastValue.current = fileData.content;
      }
    } catch {
      // Swallow — keep whatever state we have
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void fetchCards();
  }, [fetchCards]);

  // Persist column layout changes to the board file.
  const commitColumns = useCallback(
    (newColumns: BoardColumn[]) => {
      setColumns(newColumns);
      const md = serializeBoard({ columns: newColumns });
      lastValue.current = md;
      onChange(md);
    },
    [onChange],
  );

  // Debounced card save.
  const apiSaveCard = useMemo(
    () =>
      debounce(async (card: RichCard) => {
        await fetch("/api/card/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardPath: path, card }),
        });
      }, 800),
    [path],
  );

  const updateCardState = (updated: RichCard) => {
    setCards((prev) => {
      const next = new Map(prev);
      next.set(updated.id, updated);
      return next;
    });
    void apiSaveCard(updated);
  };

  const handleAddCard = async (colName: string) => {
    const res = await fetch("/api/card/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardPath: path, column: colName }),
    });
    if (!res.ok) return;
    const card = (await res.json()) as RichCard;
    setCards((prev) => new Map(prev).set(card.id, card));
    setColumns((prev) =>
      prev.map((col) => (col.name === colName ? { ...col, cards: [...col.cards, card.id] } : col)),
    );
    setAddingCol(null);
  };

  const handleDeleteCard = async (cardId: string) => {
    await fetch(
      `/api/card?boardPath=${encodeURIComponent(path)}&cardId=${encodeURIComponent(cardId)}`,
      {
        method: "DELETE",
      },
    );
    setCards((prev) => {
      const next = new Map(prev);
      next.delete(cardId);
      return next;
    });
    setColumns((prev) =>
      prev.map((col) => ({ ...col, cards: col.cards.filter((id) => id !== cardId) })),
    );
  };

  const handleMoveCard = async (drag: CardDrag, toColumn: string, toIndex: number) => {
    await fetch("/api/card/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardPath: path, cardId: drag.cardId, toColumn, toIndex }),
    });
    setColumns((prev) => {
      const next = prev.map((col) => ({
        ...col,
        cards: col.cards.filter((id) => id !== drag.cardId),
      }));
      return next.map((col) => {
        if (col.name !== toColumn) return col;
        const clampedIdx = Math.max(0, Math.min(toIndex, col.cards.length));
        const cards = [...col.cards];
        cards.splice(clampedIdx, 0, drag.cardId);
        return { ...col, cards };
      });
    });
    // Update card column frontmatter in local state
    const card = cards.get(drag.cardId);
    if (card && card.column !== toColumn) {
      setCards((prev) => new Map(prev).set(drag.cardId, { ...card, column: toColumn }));
    }
  };

  const onDragStart = (event: DragEvent, cardId: string, fromColumn: string) => {
    dragRef.current = { cardId, fromColumn };
    event.dataTransfer.effectAllowed = "move";
  };

  const onDropCard = (event: DragEvent, toColumn: string, beforeCardId: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.cardId === beforeCardId) return;
    const targetCol = columns.find((c) => c.name === toColumn);
    const toIndex =
      beforeCardId && targetCol
        ? targetCol.cards.indexOf(beforeCardId)
        : (targetCol?.cards.length ?? 0);
    void handleMoveCard(drag, toColumn, toIndex === -1 ? (targetCol?.cards.length ?? 0) : toIndex);
  };

  const addColumn = async () => {
    const values = await openPrompt({
      title: "Add column",
      fields: [{ key: "name", label: "Column name", defaultValue: "New Column", required: true }],
      confirmLabel: "Add",
    });
    const name = values?.name.trim();
    if (!name) return;
    commitColumns([...columns, { name, cards: [] }]);
  };

  const renameColumn = async (colName: string) => {
    const values = await openPrompt({
      title: "Rename column",
      fields: [{ key: "name", label: "Column name", defaultValue: colName, required: true }],
      confirmLabel: "Rename",
    });
    const name = values?.name.trim();
    if (!name || name === colName) return;
    commitColumns(columns.map((c) => (c.name === colName ? { ...c, name } : c)));
  };

  const deleteColumn = (colName: string) => {
    const col = columns.find((c) => c.name === colName);
    if (!col) return;
    if (!window.confirm(`Delete column "${colName}"${col.cards.length ? " and its cards?" : "?"}`))
      return;
    // Delete all card files in this column
    for (const cardId of col.cards) {
      void fetch(
        `/api/card?boardPath=${encodeURIComponent(path)}&cardId=${encodeURIComponent(cardId)}`,
        {
          method: "DELETE",
        },
      );
    }
    commitColumns(columns.filter((c) => c.name !== colName));
  };

  if (loading) {
    return (
      <div className="board-note">
        <div className="board-loading">Loading board…</div>
      </div>
    );
  }

  return (
    <div className="board-note">
      <div className="board-scroll">
        {columns.map((column) => (
          <section
            key={column.name}
            className="board-column"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDropCard(e, column.name, null)}
          >
            <header className="board-column-head">
              <span
                className="board-column-name"
                onDoubleClick={() => void renameColumn(column.name)}
              >
                {column.name}
              </span>
              <span className="board-column-count">{column.cards.length}</span>
              <button
                className="board-column-del"
                aria-label={`Delete column ${column.name}`}
                onClick={() => deleteColumn(column.name)}
              >
                ×
              </button>
            </header>

            <div className="board-cards">
              {column.cards.map((cardId) => {
                const card = cards.get(cardId);
                if (!card) return null;
                return (
                  <BoardCard
                    key={cardId}
                    card={card}
                    onDragStart={onDragStart}
                    onDropCard={onDropCard}
                    updateCardState={updateCardState}
                    handleDeleteCard={handleDeleteCard}
                    onOpenWikilink={onOpenWikilink}
                    column={column}
                  />
                );
              })}
            </div>

            {addingCol === column.name ? null : (
              <button className="board-add-card" onClick={() => void handleAddCard(column.name)}>
                ＋ Add card
              </button>
            )}
          </section>
        ))}

        <button className="board-add-column" onClick={() => void addColumn()}>
          ＋ Add column
        </button>
      </div>
      {promptDialog}
    </div>
  );
}
