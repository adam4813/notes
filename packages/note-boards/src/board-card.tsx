import { DragEvent, useEffect, useRef, useState } from "react";
import { MarkdownEditor } from "@notes/editor";
import type { BoardColumn, RichCard } from "./board-format";
import { PopupMenu } from "@notes/ui";

const LABEL_COLORS = ["#e2f0fb", "#fde8d8", "#d9f2e8", "#f5e6fb", "#fef9c3"];

export function BoardCard({
  card,
  isNew,
  isDragging,
  onDragStart,
  onDragEnd,
  onDropCard,
  onDragEnter,
  handleDeleteCard,
  updateCardState,
  column,
  onOpenModal,
  isColumnDragActive = false,
}: {
  card: RichCard;
  isNew?: boolean;
  isDragging?: boolean;
  onDragStart: (e: DragEvent, cardId: string, columnName: string) => void;
  onDragEnd: () => void;
  onDropCard: (e: DragEvent, columnName: string, cardId: string) => void;
  onDragEnter: (cardId: string, columnName: string) => void;
  handleDeleteCard: (cardId: string) => void;
  updateCardState: (card: RichCard) => void;
  column: BoardColumn;
  onOpenModal: (card: RichCard) => void;
  isColumnDragActive?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(isNew ?? false);
  const [menuIsOpen, setMenuIsOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  // Track whether this card was created fresh and hasn't been edited yet
  const isDiscardable = useRef(isNew ?? false);

  useEffect(() => {
    if (isNew) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [isNew]);

  const startEditing = () => {
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const commitTitle = () => {
    if (isDiscardable.current && !card.title.trim()) {
      handleDeleteCard(card.id);
      return;
    }
    setEditingTitle(false);
  };

  const handleTitleChange = (value: string) => {
    isDiscardable.current = false;
    updateCardState({ ...card, title: value });
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitTitle();
    } else if (e.key === "Escape") {
      if (isDiscardable.current) {
        handleDeleteCard(card.id);
      } else {
        setEditingTitle(false);
      }
    }
  };

  return (
    <div
      ref={cardRef}
      data-card-id={card.id}
      className={`board-card${card.done ? " board-card--done" : ""}${expanded ? " board-card--expanded" : ""}${isDragging ? " board-card--dragging" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDropCard(e, column.name, card.id)}
      onDragEnter={(e) => {
        if (isColumnDragActive) return;
        e.stopPropagation();
        onDragEnter(card.id, column.name);
      }}
    >
      {/* Collapsed view — the whole row is the drag handle */}
      {!expanded && (
        <div
          className="board-card-collapsed"
          draggable={!editingTitle}
          onDragStart={(e) => onDragStart(e, card.id, column.name)}
          onDragEnd={onDragEnd}
        >
          <button
            className="board-card-toggle"
            aria-label="Expand card"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
          >
            ▶
          </button>

          <div className="board-card-collapsed-content">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                className="board-card-title-input board-card-title-input--inline"
                value={card.title}
                placeholder="Card title"
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={handleTitleKeyDown}
              />
            ) : (
              <span
                className="board-card-title"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEditing();
                }}
              >
                {card.title || <span className="board-card-placeholder">Card title</span>}
              </span>
            )}

            {(card.labels?.length || card.priority || card.due) && (
              <div className="board-card-info-row">
                <div className="board-card-label-group">
                  {card.labels?.map((label, i) => (
                    <span
                      key={label}
                      className="board-card-chip"
                      style={{ background: LABEL_COLORS[i % LABEL_COLORS.length] }}
                    >
                      {label}
                    </span>
                  ))}
                  {card.priority && (
                    <span className={`board-card-chip board-card-chip--${card.priority}`}>
                      {card.priority}
                    </span>
                  )}
                </div>
                {card.due && (
                  <span className="board-card-chip board-card-chip--due">📅 {card.due}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expanded view — only the header is the drag handle */}
      {expanded && (
        <div className="board-card-expanded">
          <div
            className="board-card-expand-header"
            draggable={!editingTitle}
            onDragStart={(e) => {
              e.stopPropagation();
              onDragStart(e, card.id, column.name);
            }}
            onDragEnd={onDragEnd}
          >
            <button
              className="board-card-toggle"
              aria-label="Collapse card"
              onClick={() => setExpanded(false)}
            >
              ▼
            </button>

            {editingTitle ? (
              <input
                ref={titleInputRef}
                className="board-card-title-input"
                value={card.title}
                placeholder="Card title"
                onChange={(e) => updateCardState({ ...card, title: e.target.value })}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false);
                }}
              />
            ) : (
              <span
                className="board-card-title board-card-title--heading"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEditing();
                }}
              >
                {card.title || <span className="board-card-placeholder">Card title</span>}
              </span>
            )}

            <button
              className="board-card-open-modal"
              title="Open in modal"
              aria-label="Open card in modal"
              onClick={() => onOpenModal(card)}
            >
              ⤢
            </button>
            <PopupMenu
              open={menuIsOpen}
              onClose={() => setMenuIsOpen(false)}
              menu={
                <button
                  className="board-card-del"
                  aria-label="Delete card"
                  onClick={() => void handleDeleteCard(card.id)}
                >
                  🗑 Delete
                </button>
              }
            >
              <button
                className="board-card-collapse"
                title={`${card.title} menu`}
                aria-label={`${card.title} menu`}
                aria-haspopup="menu"
                aria-expanded={menuIsOpen}
                onClick={() => setMenuIsOpen((open) => !open)}
              >
                ···
              </button>
            </PopupMenu>
          </div>

          <div className="board-card-meta">
            <label className="board-card-meta-field">
              <span>Due</span>
              <input
                type="date"
                value={card.due ?? ""}
                onChange={(e) => updateCardState({ ...card, due: e.target.value || undefined })}
              />
            </label>
            <label className="board-card-meta-field">
              <span>Priority</span>
              <select
                value={card.priority ?? ""}
                onChange={(e) =>
                  updateCardState({
                    ...card,
                    priority: (e.target.value as RichCard["priority"]) || undefined,
                  })
                }
              >
                <option value="">—</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="board-card-meta-field">
              <span>Labels</span>
              <input
                type="text"
                placeholder="bug, urgent…"
                value={card.labels?.join(", ") ?? ""}
                onChange={(e) =>
                  updateCardState({
                    ...card,
                    labels: e.target.value
                      ? e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                      : undefined,
                  })
                }
              />
            </label>
          </div>

          <div className="board-card-body-editor" onDragStart={(e) => e.stopPropagation()}>
            <MarkdownEditor
              value={card.body}
              mode="rendered"
              onChange={(body) => updateCardState({ ...card, body })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
