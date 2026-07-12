import { useEffect, useRef, useState } from "react";
import { MermaidDiagram } from "./mermaid-diagram";
import { parseMermaid, serializeMermaid, type MermaidModel } from "./mermaid-format";

type MermaidMode = "split" | "source" | "preview";

interface MermaidViewProps {
  value: string;
  onChange: (markdown: string) => void;
  modes?: { id: MermaidMode; label: string }[];
  defaultMode?: MermaidMode;
}

const MODES: { id: MermaidMode; label: string }[] = [
  { id: "source", label: "Source" },
  { id: "split", label: "Split" },
  { id: "preview", label: "Preview" },
];

export function MermaidView({
  value,
  onChange,
  modes = MODES,
  defaultMode = "split",
}: MermaidViewProps) {
  const [model, setModel] = useState<MermaidModel>(() => parseMermaid(value));
  const [mode, setMode] = useState<MermaidMode>(defaultMode);
  const lastSerialized = useRef(value);

  useEffect(() => {
    if (value !== lastSerialized.current) {
      setModel(parseMermaid(value));
      lastSerialized.current = value;
    }
  }, [value]);

  const update = (source: string) => {
    const next = { ...model, source };
    setModel(next);
    const markdown = serializeMermaid(next);
    lastSerialized.current = markdown;
    onChange(markdown);
  };

  return (
    <div className="mermaid-note">
      {modes.length > 0 ? (
        <div className="mermaid-mode-switch" role="tablist" aria-label="Mermaid view mode">
          {modes.map((option) => (
            <button
              key={option.id}
              role="tab"
              aria-selected={option.id === mode}
              className={`mode-btn ${option.id === mode ? "mode-btn--active" : ""} tb-btn`}
              onClick={() => setMode(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className={`mermaid-body mermaid-body--${mode}`}>
        {mode !== "preview" && (
          <textarea
            className="mermaid-source"
            data-testid="mermaid-source"
            spellCheck={false}
            value={model.source}
            onChange={(event) => update(event.target.value)}
          />
        )}
        {mode !== "source" && (
          <div className="mermaid-preview" data-testid="mermaid-preview">
            <MermaidDiagram source={model.source} />
          </div>
        )}
      </div>
    </div>
  );
}
