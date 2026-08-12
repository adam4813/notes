import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { usePromptDialog, type RendererProps } from "@notes/editor";
import { debounce } from "@notes/core";
import { type CustomContextMenuBuilder } from "@notes/ui";
import { useUndoStack } from "@notes/web/src/state/undo-context";
import { BoardColumn } from "./board-column";
import { BoardCardModal } from "./board-card-modal";
import {
  type IBoardColumn,
  BoardModel,
  parseBoard,
  type RichCard,
  serializeBoard,
} from "./board-format";

interface CardDrag {
  cardId: string;
  fromColumn: string;
}

interface DropTarget {
  column: string;
  /** Card that will follow the dropped card; null means end of column. */
  beforeCardId: string | null;
}

export function BoardView({ value, onChange, path, onRegisterContextMenu }: RendererProps) {
  const { openPrompt, promptDialog } = usePromptDialog();
  const undoStack = useUndoStack();
  const [model, setModel] = useState<BoardModel>(() => parseBoard(value));
  const [cards, setCards] = useState<Map<string, RichCard>>(new Map());
  const cardsRef = useRef(cards);
  const [loading, setLoading] = useState(true);
  const [newCardId, setNewCardId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [modalCard, setModalCard] = useState<RichCard | null>(null);

  // Column drag state
  const [draggingColumnName, setDraggingColumnName] = useState<string | null>(null);
  const [columnDropBefore, setColumnDropBefore] = useState<string | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);

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
      const nextCards = new Map(data.cards.map((c) => [c.id, c]));
      setCards(nextCards);
      cardsRef.current = nextCards;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCards();
  }, [fetchCards]);

  // Persist column layout changes to the board file.
  const commitColumns = useCallback(
    (newColumns: IBoardColumn[]) => {
      setModel((prev) => ({ ...prev, columns: newColumns }));
      const md = serializeBoard({ ...model, columns: newColumns });
      lastValue.current = md;
      onChange(md);
    },
    [onChange, model],
  );

  // Move a column to a new position (beforeName === null => end)
  const handleMoveColumn = useCallback(
    (fromName: string, beforeName: string | null) => {
      const cols = model.columns;
      const fromIdx = cols.findIndex((c) => c.name === fromName);
      if (fromIdx === -1) return;
      const moving = cols[fromIdx];
      const without = cols.filter((c) => c.name !== fromName);
      let insertAt =
        beforeName === null ? without.length : without.findIndex((c) => c.name === beforeName);
      if (insertAt === -1) insertAt = without.length;
      const next = [...without];
      next.splice(insertAt, 0, moving);
      commitColumns(next);
    },
    [commitColumns, model.columns],
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
        cardsRef.current = next;
        return next;
      });
      // Keep modal in sync if it's showing this card
      setModalCard((prev) => (prev?.id === updated.id ? updated : prev));
      void apiSaveCard(updated);
    },
    [apiSaveCard],
  );

  const handleAddCard = useCallback(
    async (colName: string) => {
      const res = await fetch("/api/card/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardPath: path, column: colName }),
      });
      if (!res.ok) return;
      const card = (await res.json()) as RichCard;
      setCards((prev) => {
        const next = new Map(prev).set(card.id, card);
        cardsRef.current = next;
        return next;
      });
      setModel((prev) => ({
        ...prev,
        columns: prev.columns.map((col) =>
          col.name === colName ? { ...col, cards: [...col.cards, card.id] } : col,
        ),
      }));
      setNewCardId(card.id);
      setTimeout(() => setNewCardId(null), 600);
      undoStack.push({
        label: `Create card in "${colName}"`,
        undo: async () => {
          await fetch(
            `/api/card?boardPath=${encodeURIComponent(path)}&cardId=${encodeURIComponent(card.id)}`,
            { method: "DELETE" },
          );
          await fetchCards();
        },
        redo: async () => {
          await fetch("/api/card/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ boardPath: path, column: colName, id: card.id }),
          });
          await fetchCards();
        },
      });
    },
    [path, undoStack, fetchCards],
  );

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      const cardData = cards.get(cardId);
      await fetch(
        `/api/card?boardPath=${encodeURIComponent(path)}&cardId=${encodeURIComponent(cardId)}`,
        { method: "DELETE" },
      );
      setCards((prev) => {
        const next = new Map(prev);
        next.delete(cardId);
        cardsRef.current = next;
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
      if (cardData) {
        const cardLabel = cardData.title?.trim() ? `"${cardData.title}"` : "card";
        undoStack.push({
          label: `Delete ${cardLabel}`,
          undo: async () => {
            await fetch("/api/card/update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ boardPath: path, card: cardData }),
            });
            await fetchCards();
          },
          redo: async () => {
            await fetch(
              `/api/card?boardPath=${encodeURIComponent(path)}&cardId=${encodeURIComponent(cardId)}`,
              { method: "DELETE" },
            );
            await fetchCards();
          },
        });
      }
    },
    [path, cards, undoStack, fetchCards],
  );

  const handleMoveCard = useCallback(
    async (drag: CardDrag, toColumn: string, beforeCardId: string | null) => {
      const fromColumn = drag.fromColumn;
      const fromCol = model.columns.find((c) => c.name === fromColumn);
      const fromIndex = fromCol?.cards.indexOf(drag.cardId) ?? 0;
      const targetCol = model.columns.find((c) => c.name === toColumn);
      let toIndex =
        beforeCardId && targetCol
          ? targetCol.cards.indexOf(beforeCardId)
          : (targetCol?.cards.length ?? 0);
      if (toIndex === -1) {
        toIndex = targetCol?.cards.length ?? 0;
      }
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
        setCards((prev) => {
          const next = new Map(prev).set(drag.cardId, { ...card, column: toColumn });
          cardsRef.current = next;
          return next;
        });
      }
      undoStack.push({
        label: `Move card to "${toColumn}"`,
        undo: async () => {
          await fetch("/api/card/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              boardPath: path,
              cardId: drag.cardId,
              toColumn: fromColumn,
              toIndex: fromIndex,
            }),
          });
          await fetchCards();
        },
        redo: async () => {
          await fetch("/api/card/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ boardPath: path, cardId: drag.cardId, toColumn, toIndex }),
          });
          await fetchCards();
        },
      });
    },
    [path, model, cards, undoStack, fetchCards],
  );

  const duplicateCard = useCallback(
    async (original: RichCard) => {
      const res = await fetch("/api/card/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardPath: path, cardId: original.id }),
      });
      if (!res.ok) return;
      const copy = (await res.json()) as RichCard;
      setCards((prev) => {
        const next = new Map(prev).set(copy.id, copy);
        cardsRef.current = next;
        return next;
      });
      setModel((prev) => ({
        ...prev,
        columns: prev.columns.map((col) => {
          const idx = col.cards.indexOf(original.id);
          if (idx === -1) return col;
          const next = [...col.cards];
          next.splice(idx + 1, 0, copy.id);
          return { ...col, cards: next };
        }),
      }));
    },
    [path],
  );

  // Register a context menu builder with the parent NoteEditor so right-clicking
  // a card shows card-specific actions instead of the generic edit menu.
  useEffect(() => {
    if (!onRegisterContextMenu) return;
    const builder: CustomContextMenuBuilder = (target) => {
      const cardEl = target?.closest("[data-card-id]");
      // Return [] (not null) so the generic edit menu (undo/redo/cut…) is
      // suppressed entirely — those commands don't apply to board operations.
      if (!cardEl) return [];
      const cardId = cardEl.getAttribute("data-card-id");
      if (!cardId) return [];
      const card = cardsRef.current.get(cardId);
      if (!card) return [];
      return [
        {
          label: "Duplicate card",
          run: () => void duplicateCard(card),
        },
        { separator: true as const },
        {
          label: "Delete card",
          run: () => {
            void handleDeleteCard(cardId);
          },
          danger: true,
        },
      ];
    };
    onRegisterContextMenu(builder);
    return () => onRegisterContextMenu(null);
  }, [duplicateCard, handleDeleteCard, onRegisterContextMenu]);

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

  // Column drag handlers
  const onColumnDragStart = (event: DragEvent, columnName: string) => {
    event.dataTransfer.effectAllowed = "move";
    try {
      event.dataTransfer.setData("application/x-notes-board-column", columnName);
    } catch {
      console.error("Failed to set drag data for column:", columnName);
    }
    setDraggingColumnName(columnName);
  };

  const onColumnDragEnd = () => {
    setColumnDropBefore(null);
    setDraggingColumnName(null);
  };

  const onDropColumn = (event: DragEvent, beforeColumnName: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    const from = draggingColumnName;
    setDraggingColumnName(null);
    setColumnDropBefore(null);
    if (!from) return;
    // No-op when dropping before itself
    if (from === beforeColumnName) return;
    handleMoveColumn(from, beforeColumnName);
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
        <div
          className="board-scroll"
          ref={boardScrollRef}
          onDragEnter={(e) => e.stopPropagation()}
          onDragOver={(e) => e.preventDefault()}
        >
          {model.columns.map((column) => (
            <Fragment key={column.name}>
              {columnDropBefore === column.name && draggingColumnName && (
                <div
                  className="board-column-silhouette"
                  onDragEnter={(e) => e.stopPropagation()}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setColumnDropBefore(null);
                    }
                  }}
                  onDrop={(e) => onDropColumn(e, column.name)}
                />
              )}
              <BoardColumn
                column={column}
                cards={cards}
                onRenameColumn={renameColumn}
                onDeleteColumn={deleteColumn}
                onColumnDragStart={onColumnDragStart}
                onColumnDragEnd={onColumnDragEnd}
                draggingColumnName={draggingColumnName}
                setColumnDropBefore={setColumnDropBefore}
                onDropColumn={onDropColumn}
                dropTarget={dropTarget}
                setDropTarget={setDropTarget}
                onAddCard={handleAddCard}
                onMoveCard={handleMoveCard}
                newCardId={newCardId}
                updateCardState={updateCardState}
                handleDeleteCard={handleDeleteCard}
                setModalCard={setModalCard}
                dragRef={dragRef}
              />
            </Fragment>
          ))}

          {/* Silhouette at end of board for dropping columns at the end */}
          {draggingColumnName && columnDropBefore === null && (
            <div
              className="board-column-silhouette"
              onDragEnter={(e) => e.stopPropagation()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDropColumn(e, null)}
            />
          )}

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
