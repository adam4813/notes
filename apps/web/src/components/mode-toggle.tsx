import { EDITOR_MODES, EditorMode } from "@notes/editor";

export type SaveState =
  "loading" | "saved" | "saving" | "unsaved" | "error" | "external" | "offline";

const MODE_LABEL: Record<EditorMode, string> = {
  edit: "Edit",
  split: "Split",
  rendered: "Rendered",
};

const SAVE_LABEL: Record<SaveState, string> = {
  loading: "Loading…",
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved…",
  error: "Save failed",
  external: "Changed on disk",
  offline: "Saved offline",
};

export function ModeToggle(props: {
  onChangeMode: (nextMode: EditorMode) => void;
  mode: EditorMode;
  splitScrollSync: boolean;
  onToggleSyncScroll: () => void;
  saveState: SaveState;
}) {
  return (
    <div className="mode-float">
      <div className="mode-switch mode-switch--floating" role="tablist">
        {EDITOR_MODES.map((mode) => (
          <button
            key={mode}
            role="tab"
            aria-selected={mode === props.mode}
            className={`mode-btn ${mode === props.mode ? "mode-btn--active" : ""}`}
            onClick={() => {
              props.onChangeMode(mode);
            }}
          >
            {MODE_LABEL[mode]}
          </button>
        ))}
      </div>
      {props.mode === "split" && (
        <button
          type="button"
          className={`mode-sync-toggle ${props.splitScrollSync ? "mode-sync-toggle--on" : ""}`}
          onClick={props.onToggleSyncScroll}
          title="Sync scroll positions between source and rendered panes"
          aria-pressed={props.splitScrollSync}
        >
          Sync scroll
        </button>
      )}
      <span className={`save-status save-status--${props.saveState}`}>
        {SAVE_LABEL[props.saveState]}
      </span>
    </div>
  );
}
