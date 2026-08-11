import { useEffect, useRef, useState } from "react";
import type { RendererProps } from "@notes/editor";
import { MermaidDiagram } from "./mermaid-diagram";
import { parseMermaid, type MermaidModel } from "./mermaid-format";

export function MermaidView({ value }: RendererProps) {
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
