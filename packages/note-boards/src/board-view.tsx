import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { usePromptDialog } from "@notes/editor";
import { BoardCard } from "./board-card";
import { BoardCardModal } from "./board-card-modal";
import {
  type BoardColumn,
  BoardModel,
  parseBoard,
  type RichCard,
  serializeBoard,
} from "./board-format";

interface BoardViewProps {
  value: string;
  onChange: (markdown: string) => void;
  path: string;
}

interface CardDrag {
  cardId: string;
  fromColumn: string;
}

interface DropTarget {
  column: string;
  /** Card that will follow the dropped card; null means end of column. */
  beforeCardId: string | null;
}

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function BoardView({ value, onChange, path }: BoardViewProps) {
  const { openPrompt, promptDialog } = usePromptDialog();
  const [model, setModel] = useState<BoardModel>(() => parseBoard(value));
  const [cards, setCards] = useState<Map<string, RichCard>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newCardId, setNewCardId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [modalCard, setModalCard] = useState<RichCard | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const lastValue = useRef(value);
  const dragRef = useRef<CardDrag | null>(null);

  // Sync columns when value changes from external edit (file watcher).
  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value;
      setModel(parseBoard(value));
    }
  }, [value]);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cards?boardPath=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as { cards: RichCard[] };
      setCards(new Map(data.cards.map((c) => [c.id, c])));
      const fileRes = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
      if (fileRes.ok) {
        const fileData = (await fileRes.json()) as { content: string };
        const parsedModel = parseBoard(fileData.content);
        setModel(parsedModel);
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
      setModel((prev) => ({ ...prev, columns: newColumns }));
      const md = serializeBoard({ ...model, columns: newColumns });
      lastValue.current = md;
      onChange(md);
    },
    [onChange, model],
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

  const updateCardState = useCallback(
    (updated: RichCard) => {
      setCards((prev) => {
        const next = new Map(prev);
        next.set(updated.id, updated);
        return next;
      });
      // Keep modal in sync if it's showing this card
      setModalCard((prev) => (prev?.id === updated.id ? updated : prev));
      void apiSaveCard(updated);
    },
    [apiSaveCard],
  );

  const handleAddCard = async (colName: string) => {
    const res = await fetch("/api/card/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardPath: path, column: colName }),
    });
    if (!res.ok) return;
    const card = (await res.json()) as RichCard;
    setCards((prev) => new Map(prev).set(card.id, card));
    setModel((prev) => ({
      ...prev,
      columns: prev.columns.map((col) =>
        col.name === colName ? { ...col, cards: [...col.cards, card.id] } : col,
      ),
    }));
    setNewCardId(card.id);
    // Clear the "new" marker after enough time for the card to mount and focus
    setTimeout(() => setNewCardId(null), 600);
  };

  const handleDeleteCard = async (cardId: string) => {
    await fetch(
      `/api/card?boardPath=${encodeURIComponent(path)}&cardId=${encodeURIComponent(cardId)}`,
      { method: "DELETE" },
    );
    setCards((prev) => {
      const next = new Map(prev);
      next.delete(cardId);
      return next;
    });
    setModel((prev) => ({
      ...prev,
      columns: prev.columns.map((col) => ({
        ...col,
        cards: col.cards.filter((id) => id !== cardId),
      })),
    }));
    setModalCard((prev) => (prev?.id === cardId ? null : prev));
  };

  const handleMoveCard = async (drag: CardDrag, toColumn: string, toIndex: number) => {
    await fetch("/api/card/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardPath: path, cardId: drag.cardId, toColumn, toIndex }),
    });
    setModel((prev) => {
      const stripped = prev.columns.map((col) => ({
        ...col,
        cards: col.cards.filter((id) => id !== drag.cardId),
      }));
      return {
        ...prev,
        columns: stripped.map((col) => {
          if (col.name !== toColumn) return col;
          const clampedIdx = Math.max(0, Math.min(toIndex, col.cards.length));
          const next = [...col.cards];
          next.splice(clampedIdx, 0, drag.cardId);
          return { ...col, cards: next };
        }),
      };
    });
    const card = cards.get(drag.cardId);
    if (card && card.column !== toColumn) {
      setCards((prev) => new Map(prev).set(drag.cardId, { ...card, column: toColumn }));
    }
  };

  const onDragStart = (event: DragEvent, cardId: string, fromColumn: string) => {
    dragRef.current = { cardId, fromColumn };
    event.dataTransfer.effectAllowed = "move";
    setDraggingCardId(cardId);
  };

  const onDragEnd = () => {
    setDropTarget(null);
    setDraggingCardId(null);
    dragRef.current = null;
  };

  const onDropCard = (event: DragEvent, toColumn: string, beforeCardId: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);
    setDraggingCardId(null);
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.cardId === beforeCardId) return;
    const targetCol = model.columns.find((c) => c.name === toColumn);
    const toIndex =
      beforeCardId && targetCol
        ? targetCol.cards.indexOf(beforeCardId)
        : (targetCol?.cards.length ?? 0);
    void handleMoveCard(drag, toColumn, toIndex === -1 ? (targetCol?.cards.length ?? 0) : toIndex);
  };

  const onCardDragEnter = (cardId: string, columnName: string) => {
    setDropTarget({ column: columnName, beforeCardId: cardId });
  };

  const addColumn = async () => {
    const values = await openPrompt({
      title: "Add column",
      fields: [{ key: "name", label: "Column name", defaultValue: "New Column", required: true }],
      confirmLabel: "Add",
    });
    const name = values?.name.trim();
    if (!name) return;
    commitColumns([...model.columns, { name, cards: [] }]);
  };

  const renameColumn = async (colName: string) => {
    const values = await openPrompt({
      title: "Rename column",
      fields: [{ key: "name", label: "Column name", defaultValue: colName, required: true }],
      confirmLabel: "Rename",
    });
    const name = values?.name.trim();
    if (!name || name === colName) return;
    commitColumns(model.columns.map((c) => (c.name === colName ? { ...c, name } : c)));
  };

  const deleteColumn = (colName: string) => {
    const col = model.columns.find((c) => c.name === colName);
    if (!col) return;
    if (!window.confirm(`Delete column "${colName}"${col.cards.length ? " and its cards?" : "?"}`))
      return;
    for (const cardId of col.cards) {
      void fetch(
        `/api/card?boardPath=${encodeURIComponent(path)}&cardId=${encodeURIComponent(cardId)}`,
        { method: "DELETE" },
      );
    }
    commitColumns(model.columns.filter((c) => c.name !== colName));
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
      <div style={{ paddingBottom: "2px", height: "100%", background: "var(--bg-island)" }}>
        <div className="board-scroll">
          {model.columns.map((column) => {
            const isDragOver = dropTarget?.column === column.name;
            return (
              <section
                key={column.name}
                className={`board-column${isDragOver ? " board-column--drag-over" : ""}`}
                onDragEnter={(e) => {
                  // Only fires when cursor enters column area not covered by a card or silhouette
                  // (those stop propagation). Set drop to end-of-column.
                  e.preventDefault();
                  setDropTarget({ column: column.name, beforeCardId: null });
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  // Use the tracked dropTarget so drops on silhouette land in the right spot
                  const beforeId =
                    dropTarget?.column === column.name ? dropTarget.beforeCardId : null;
                  onDropCard(e, column.name, beforeId);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDropTarget(null);
                  }
                }}
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
                    const isDraggedCard = dragRef.current?.cardId === cardId;
                    const showSilhouette =
                      !isDraggedCard &&
                      dropTarget?.column === column.name &&
                      dropTarget.beforeCardId === cardId;
                    return (
                      <Fragment key={cardId}>
                        {showSilhouette && (
                          <div
                            className="board-card-silhouette"
                            onDragEnter={(e) => e.stopPropagation()}
                            onDragOver={(e) => e.preventDefault()}
                          />
                        )}
                        <BoardCard
                          card={card}
                          isNew={card.id === newCardId}
                          isDragging={card.id === draggingCardId}
                          onDragStart={onDragStart}
                          onDragEnd={onDragEnd}
                          onDropCard={onDropCard}
                          onDragEnter={onCardDragEnter}
                          updateCardState={updateCardState}
                          handleDeleteCard={handleDeleteCard}
                          column={column}
                          onOpenModal={setModalCard}
                        />
                      </Fragment>
                    );
                  })}
                  {/* Silhouette at end of column */}
                  {dropTarget?.column === column.name && dropTarget.beforeCardId === null && (
                    <div
                      className="board-card-silhouette"
                      onDragEnter={(e) => e.stopPropagation()}
                      onDragOver={(e) => e.preventDefault()}
                    />
                  )}
                </div>

                <button className="board-add-card" onClick={() => void handleAddCard(column.name)}>
                  ＋ Add card
                </button>
              </section>
            );
          })}

          <button className="board-add-column" onClick={() => void addColumn()}>
            ＋ Add column
          </button>
        </div>
      </div>

      {modalCard && (
        <BoardCardModal
          card={modalCard}
          onClose={() => setModalCard(null)}
          updateCardState={updateCardState}
        />
      )}

      {promptDialog}
    </div>
  );
}
