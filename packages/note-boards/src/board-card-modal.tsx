import { MarkdownEditor } from "@notes/editor";
import { Modal, ModalBody, ModalHeader } from "@notes/ui";
import type { RichCard } from "./board-format";

export function BoardCardModal({
  card,
  onClose,
  updateCardState,
}: {
  card: RichCard;
  onClose: () => void;
  updateCardState: (card: RichCard) => void;
}) {
  return (
    <Modal open onClose={onClose} ariaLabel="Edit card">
      <ModalHeader onClose={onClose}>
        <input
          className="board-modal-title"
          value={card.title}
          placeholder="Card title"
          autoFocus
          onChange={(e) => updateCardState({ ...card, title: e.target.value })}
        />
      </ModalHeader>

      <ModalBody>
        <div className="board-modal-meta">
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

        <MarkdownEditor
          value={card.body}
          mode="rendered"
          onChange={(body) => updateCardState({ ...card, body })}
        />
      </ModalBody>
    </Modal>
  );
}
