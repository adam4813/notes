import { useDraggable } from "@notes/ui";
import { Fragment, DragEvent } from "react";
import { BoardCard } from "./board-card";
import type { IBoardColumn, RichCard } from "./board-format";

export function BoardColumn({
  column,
  cards,
  onRenameColumn,
  onDeleteColumn,
  onColumnDragStart,
  onColumnDragEnd,
  draggingColumnName,
  setColumnDropBefore,
  onDropColumn,
  dropTarget,
  setDropTarget,
  onAddCard,
  onMoveCard,
  newCardId,
  updateCardState,
  handleDeleteCard,
  setModalCard,
  boardPath,
  dragRef,
}: {
  column: IBoardColumn;
  cards: Map<string, RichCard>;
  onRenameColumn: (columnName: string) => void;
  onDeleteColumn: (columnName: string) => void;
  onColumnDragStart: (e: DragEvent, columnName: string) => void;
  onColumnDragEnd: () => void;
  draggingColumnName: string | null;
  setColumnDropBefore: (columnName: string | null) => void;
  onDropColumn: (e: DragEvent, beforeColumnName: string | null) => void;
  dropTarget: { column: string; beforeCardId: string | null } | null;
  setDropTarget: (target: { column: string; beforeCardId: string | null } | null) => void;
  onAddCard: (columnName: string) => void;
  onMoveCard: (
    drag: {
      cardId: string;
      fromColumn: string;
    },
    toColumn: string,
    beforeCardId: string | null,
  ) => void;
  newCardId: string | null;
  updateCardState: (updated: RichCard) => void;
  handleDeleteCard: (cardId: string) => void;
  setModalCard: (card: RichCard | null) => void;
  boardPath: string;
  dragRef: React.RefObject<{ cardId: string; fromColumn: string } | null>;
}) {
  const dragHandle = useDraggable(
    {
      onDragStart: onColumnDragStart,
      onDragEnd: onColumnDragEnd,
    },
    column.name,
  );

  const onCardDragStart = (event: DragEvent, cardId: string, fromColumn: string) => {
    dragRef.current = { cardId, fromColumn };
    event.dataTransfer.effectAllowed = "move";
    // Mark this drag as a card drag so nested elements can distinguish it
    try {
      event.dataTransfer.setData("application/x-notes-board-card", cardId);
    } catch (error) {
      console.error("Failed to set drag data:", error);
    }
  };

  const onCardDragEnd = () => {
    setDropTarget(null);
    dragRef.current = null;
  };

  const onDropCard = (event: DragEvent, toColumn: string, beforeCardId: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.cardId === beforeCardId) return;
    void onMoveCard(drag, toColumn, beforeCardId);
  };

  const onCardDragEnter = (cardId: string, columnName: string) => {
    setDropTarget({ column: columnName, beforeCardId: cardId });
  };

  return (
    <section
      key={column.name}
      className="board-column"
      onDragEnter={(e) => {
        e.stopPropagation();
        if (draggingColumnName) {
          setColumnDropBefore(column.name);
          return;
        }
        setDropTarget({ column: column.name, beforeCardId: null });
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        if (draggingColumnName) {
          onDropColumn(e, column.name);
          return;
        }
        // Use the tracked dropTarget so drops on silhouette land in the right spot
        const beforeId = dropTarget?.column === column.name ? dropTarget.beforeCardId : null;
        onDropCard(e, column.name, beforeId);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) {
          return;
        }
        if (!draggingColumnName) {
          setDropTarget(null);
        }
        if (!e.currentTarget.closest(".board-scroll")?.contains(e.relatedTarget as Node)) {
          setColumnDropBefore(null);
        }
      }}
    >
      <header className="board-column-head" {...dragHandle}>
        <span className="board-column-name" onDoubleClick={() => void onRenameColumn(column.name)}>
          {column.name}
        </span>
        <span className="board-column-count">{column.cards.length}</span>
        <button
          className="board-column-del"
          aria-label={`Delete column ${column.name}`}
          onClick={() => onDeleteColumn(column.name)}
        >
          ×
        </button>
      </header>

      <div className="board-cards">
        {column.cards.map((cardId) => {
          const card = cards.get(cardId);
          if (!card) return null;
          return (
            <Fragment key={cardId}>
              {dropTarget?.column === column.name && dropTarget.beforeCardId === cardId && (
                <div
                  className="board-card-silhouette"
                  onDragEnter={(e) => e.stopPropagation()}
                  onDragOver={(e) => e.preventDefault()}
                />
              )}
              <BoardCard
                card={card}
                isNew={card.id === newCardId}
                onDragStart={onCardDragStart}
                onDragEnd={onCardDragEnd}
                onDropCard={onDropCard}
                onDragEnter={onCardDragEnter}
                updateCardState={updateCardState}
                handleDeleteCard={handleDeleteCard}
                column={column}
                onOpenModal={setModalCard}
                boardPath={boardPath}
                isColumnDragActive={Boolean(draggingColumnName)}
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

      <button className="board-add-card" onClick={() => void onAddCard(column.name)}>
        ＋ Add card
      </button>
    </section>
  );
}
