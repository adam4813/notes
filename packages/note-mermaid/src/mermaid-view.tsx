import { useEffect, useRef, useState } from "react";
import { MermaidDiagram } from "./mermaid-diagram";
import { parseMermaid, type MermaidModel } from "./mermaid-format";

interface MermaidViewProps {
  value: string;
  onChange: (markdown: string) => void;
}

export function MermaidView({ value }: MermaidViewProps) {
  const [model, setModel] = useState<MermaidModel>(() => parseMermaid(value));
  const lastSerialized = useRef(value);

  useEffect(() => {
    if (value !== lastSerialized.current) {
      setModel(parseMermaid(value));
      lastSerialized.current = value;
    }
  }, [value]);

  return (
    <div className="mermaid-note">
      <div className="mermaid-body">
        <div className="mermaid-preview" data-testid="mermaid-preview">
          <MermaidDiagram source={model.source} />
        </div>
      </div>
    </div>
  );
}
