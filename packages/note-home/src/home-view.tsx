import { NoteEditor } from "@notes/web/src/components/note-editor";
import { useUndoStack } from "@notes/web/src/state/undo-context";
import { NOTES_PATH_MIME, noteNameFromPath, type RendererProps } from "@notes/editor";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  clampWidget,
  moveWidget,
  newId,
  parseHome,
  resizeWidget,
  serializeHome,
  usedRows,
  type HomeModel,
  type HomeWidget,
} from "./home-format";

const NOTE_WIDGET_DEFAULT = { w: 4, h: 4 };
const TEXT_WIDGET_DEFAULT = { w: 4, h: 2 };

type DragState = {
  mode: "move" | "resize";
  id: string;
  startX: number;
  startY: number;
  colWidth: number;
  orig: HomeWidget;
} | null;

function sameGeometry(a: HomeWidget, b: HomeWidget): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export function HomeView({ value, onChange, callbacks }: RendererProps) {
  const undoStack = useUndoStack();
  const [model, setModel] = useState<HomeModel>(() => parseHome(value));
  const [preview, setPreview] = useState<HomeWidget | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const modelRef = useRef(model);
  const lastSerialized = useRef(value);
  const dragRef = useRef<DragState>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (value !== lastSerialized.current) {
      const parsed = parseHome(value);
      setModel(parsed);
      modelRef.current = parsed;
      lastSerialized.current = value;
    }
  }, [value]);

  const commit = (next: HomeModel, label: string) => {
    const previous = modelRef.current;
    const previousMarkdown = serializeHome(previous);
    const markdown = serializeHome(next);
    setModel(next);
    modelRef.current = next;
    lastSerialized.current = markdown;
    undoStack.push({
      label,
      undo: () => {
        setModel(previous);
        modelRef.current = previous;
        lastSerialized.current = previousMarkdown;
        onChange(previousMarkdown);
        return Promise.resolve();
      },
      redo: () => {
        setModel(next);
        modelRef.current = next;
        lastSerialized.current = markdown;
        onChange(markdown);
        return Promise.resolve();
      },
    });
    onChange(markdown);
  };

  const patchWidget = (id: string, patch: Partial<HomeWidget>, label: string) => {
    const current = modelRef.current;
    commit(
      {
        ...current,
        widgets: current.widgets.map((widget) =>
          widget.id === id ? clampWidget({ ...widget, ...patch }, current.columns) : widget,
        ),
      },
      label,
    );
  };

  const addTextWidget = () => {
    const current = modelRef.current;
    const widget = clampWidget(
      {
        id: newId(),
        kind: "text",
        x: 0,
        y: usedRows(current.widgets),
        w: TEXT_WIDGET_DEFAULT.w,
        h: TEXT_WIDGET_DEFAULT.h,
        title: "Note",
        text: "",
      },
      current.columns,
    );
    commit({ ...current, widgets: [...current.widgets, widget] }, "Added text widget");
  };

  const removeWidget = (id: string) => {
    const current = modelRef.current;
    commit(
      { ...current, widgets: current.widgets.filter((widget) => widget.id !== id) },
      "Removed widget",
    );
  };

  const geometryFor = (widget: HomeWidget): HomeWidget =>
    preview && preview.id === widget.id ? preview : widget;

  const beginDrag = (
    mode: "move" | "resize",
    widget: HomeWidget,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = surfaceRef.current?.getBoundingClientRect();
    const colWidth = rect ? rect.width / model.columns : 100;
    dragRef.current = {
      mode,
      id: widget.id,
      startX: event.clientX,
      startY: event.clientY,
      colWidth,
      orig: widget,
    };
    setPreview(widget);
    surfaceRef.current?.setPointerCapture?.(event.pointerId);
  };

  const computeDragged = (drag: NonNullable<DragState>, event: ReactPointerEvent): HomeWidget => {
    const dxCells = Math.round((event.clientX - drag.startX) / drag.colWidth);
    const dyCells = Math.round((event.clientY - drag.startY) / model.rowHeight);
    return drag.mode === "move"
      ? moveWidget(drag.orig, dxCells, dyCells, model.columns)
      : resizeWidget(drag.orig, dxCells, dyCells, model.columns);
  };

  const onSurfacePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    setPreview(computeDragged(drag, event));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    surfaceRef.current?.releasePointerCapture?.(event.pointerId);
    const next = computeDragged(drag, event);
    dragRef.current = null;
    setPreview(null);
    if (!sameGeometry(next, drag.orig)) {
      patchWidget(drag.id, { x: next.x, y: next.y, w: next.w, h: next.h }, "Moved widget");
    }
  };

  const onSurfaceDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes(NOTES_PATH_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const onSurfaceDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    const notePath = event.dataTransfer.getData(NOTES_PATH_MIME);
    if (!notePath) {
      return;
    }
    event.preventDefault();
    const rect = surfaceRef.current?.getBoundingClientRect();
    const colWidth = rect ? rect.width / model.columns : 100;
    const x = rect ? Math.floor((event.clientX - rect.left) / colWidth) : 0;
    const y = rect ? Math.floor((event.clientY - rect.top) / model.rowHeight) : 0;
    const widget = clampWidget(
      {
        id: newId(),
        kind: "note",
        notePath,
        x,
        y,
        w: NOTE_WIDGET_DEFAULT.w,
        h: NOTE_WIDGET_DEFAULT.h,
      },
      model.columns,
    );
    commit({ ...model, widgets: [...model.widgets, widget] }, "Added note widget");
  };

  const draftKey = (id: string, field: "text" | "title") => `${id}:${field}`;

  const draftValue = (widget: HomeWidget, field: "text" | "title"): string => {
    const key = draftKey(widget.id, field);
    if (key in drafts) {
      return drafts[key];
    }
    return (field === "text" ? widget.text : widget.title) ?? "";
  };

  const setDraft = (id: string, field: "text" | "title", value: string) => {
    setDrafts((current) => ({ ...current, [draftKey(id, field)]: value }));
  };

  const commitDraft = (widget: HomeWidget, field: "text" | "title") => {
    const key = draftKey(widget.id, field);
    if (!(key in drafts)) {
      return;
    }
    const value = drafts[key];
    setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    const original = (field === "text" ? widget.text : widget.title) ?? "";
    if (value !== original) {
      patchWidget(widget.id, { [field]: value }, "Edited widget");
    }
  };

  const surfaceRows = Math.max(usedRows(model.widgets) + 2, 6);

  return (
    <div className="home-note" data-testid="home-note">
      <div className="home-toolbar">
        <div className="home-toolbar-actions">
          <button className="home-btn" onClick={addTextWidget}>
            ＋ Text widget
          </button>
        </div>
        <div className="home-toolbar-history">
          <button
            className="home-btn"
            aria-label="Undo"
            disabled={!undoStack.canUndo}
            onClick={undoStack.undo}
          >
            ↶
          </button>
          <button
            className="home-btn"
            aria-label="Redo"
            disabled={!undoStack.canRedo}
            onClick={undoStack.redo}
          >
            ↷
          </button>
        </div>
        <div className="home-toolbar-hint">
          Drag notes from the explorer to add them as widgets.
        </div>
      </div>

      <div
        ref={surfaceRef}
        className="home-surface"
        data-testid="home-surface"
        style={{
          gridTemplateColumns: `repeat(${model.columns}, 1fr)`,
          gridAutoRows: `${model.rowHeight}px`,
          minHeight: surfaceRows * model.rowHeight,
        }}
        onPointerMove={onSurfacePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDragOver={onSurfaceDragOver}
        onDrop={onSurfaceDrop}
      >
        {model.widgets.length === 0 && (
          <div className="home-empty">
            <p>Your homepage is empty.</p>
            <p>Drag a note here, or add a text widget to get started.</p>
          </div>
        )}
        {model.widgets.map((widget) => {
          const geometry = geometryFor(widget);
          const dragging = preview?.id === widget.id;
          return (
            <div
              key={widget.id}
              className={`home-widget${dragging ? " home-widget--dragging" : ""}`}
              style={{
                gridColumn: `${geometry.x + 1} / span ${geometry.w}`,
                gridRow: `${geometry.y + 1} / span ${geometry.h}`,
              }}
            >
              <div className="home-widget-card">
                <div
                  className="home-widget-header"
                  onPointerDown={(event) => beginDrag("move", widget, event)}
                >
                  <span className="home-widget-grip" aria-hidden>
                    ⠿
                  </span>
                  {widget.kind === "text" ? (
                    <input
                      className="home-widget-title-input"
                      aria-label="Widget title"
                      value={draftValue(widget, "title")}
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(event) => setDraft(widget.id, "title", event.target.value)}
                      onBlur={() => commitDraft(widget, "title")}
                    />
                  ) : (
                    <span className="home-widget-title" title={widget.notePath}>
                      {widget.title?.trim() || noteNameFromPath(widget.notePath ?? "Note")}
                    </span>
                  )}
                  <span className="home-widget-actions">
                    {widget.kind === "note" && widget.notePath && (
                      <button
                        className="home-widget-btn"
                        aria-label="Open in tab"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => callbacks?.onOpenFile?.(widget.notePath as string)}
                      >
                        ⤢
                      </button>
                    )}
                    <button
                      className="home-widget-btn"
                      aria-label="Remove widget"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => removeWidget(widget.id)}
                    >
                      ×
                    </button>
                  </span>
                </div>

                <div
                  className="home-widget-body"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  {widget.kind === "note" && widget.notePath ? (
                    <NoteEditor path={widget.notePath} defaultMode="rendered" disableModeToggle />
                  ) : (
                    <textarea
                      className="home-widget-text"
                      aria-label="Widget text"
                      placeholder="Write anything…"
                      value={draftValue(widget, "text")}
                      onChange={(event) => setDraft(widget.id, "text", event.target.value)}
                      onBlur={() => commitDraft(widget, "text")}
                    />
                  )}
                </div>

                <span
                  className="home-widget-resize"
                  aria-hidden
                  onPointerDown={(event) => beginDrag("resize", widget, event)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
