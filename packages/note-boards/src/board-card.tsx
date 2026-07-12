import { DragEvent, useState } from "react";
import { MarkdownEditor } from "@notes/editor";
import type { BoardColumn, RichCard } from "./board-format";
import { PopupMenu } from "@notes/ui";

const LABEL_COLORS = ["#e2f0fb", "#fde8d8", "#d9f2e8", "#f5e6fb", "#fef9c3"];

export function BoardCard({
  card,
  onDragStart,
  onDropCard,
  handleDeleteCard,
  onOpenWikilink,
  updateCardState,
  column,
}: {
  card: RichCard;
  onDragStart: (e: DragEvent, cardId: string, columnName: string) => void;
  onDropCard: (e: DragEvent, columnName: string, cardId: string) => void;
  handleDeleteCard: (cardId: string) => void;
  onOpenWikilink?: (name: string) => void;
  updateCardState: (card: RichCard) => void;
  column: BoardColumn;
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuIsOpen, setMenuIsOpen] = useState(false);

  return (
    <div
      className={`board-card ${card.done ? "board-card--done" : ""} ${expanded ? "board-card--expanded" : ""}`}
      draggable={!expanded}
      onDragStart={(e) => onDragStart(e, card.id, column.name)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDropCard(e, column.name, card.id)}
      onClick={() => !expanded && setExpanded(true)}
    >
      {/* Collapsed view */}
      {!expanded && (
        <div className="board-card-collapsed">
          <input
            type="checkbox"
            checked={card.done}
            onChange={(e) => {
              e.stopPropagation();
              updateCardState({ ...card, done: !card.done });
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="board-card-title">{card.title || "(untitled)"}</span>
          <div className="board-card-chips">
            {card.priority && (
              <span className={`board-card-chip board-card-chip--${card.priority}`}>
                {card.priority}
              </span>
            )}
            {card.due && (
              <span className="board-card-chip board-card-chip--due">📅 {card.due}</span>
            )}
            {card.labels?.map((label, i) => (
              <span
                key={label}
                className="board-card-chip"
                style={{ background: LABEL_COLORS[i % LABEL_COLORS.length] }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expanded view */}
      {expanded && (
        <div className="board-card-expanded" onClick={(e) => e.stopPropagation()}>
          <div className="board-card-expand-header">
            <input
              type="checkbox"
              checked={card.done}
              onChange={() => updateCardState({ ...card, done: !card.done })}
            />
            <input
              className="board-card-title-input"
              value={card.title}
              onChange={(e) => updateCardState({ ...card, title: e.target.value })}
              placeholder="Card title"
            />
            <button
              className="board-card-collapse"
              aria-label="Collapse card"
              onClick={() => setExpanded(false)}
            >
              ↑
            </button>
            <PopupMenu
              open={menuIsOpen}
              onClose={() => setMenuIsOpen(false)}
              menu={
                <>
                  <button
                    className="board-card-del"
                    aria-label="Delete card"
                    onClick={() => void handleDeleteCard(card.id)}
                  >
                    🗑 Delete
                  </button>
                </>
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
                ...
              </button>
            </PopupMenu>
          </div>

          <div className="board-card-meta">
            <label className="board-card-meta-field">
              <span>Due</span>
              <input
                type="date"
                value={card.due ?? ""}
                onChange={(e) =>
                  updateCardState({
                    ...card,
                    due: e.target.value || undefined,
                  })
                }
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

          <div className="board-card-body-editor">
            <MarkdownEditor
              value={card.body}
              mode="rendered"
              onChange={(body) => updateCardState({ ...card, body })}
              callbacks={{
                onOpenWikilink,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
