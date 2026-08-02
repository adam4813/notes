import { useEffect, useRef, useState } from "react";

interface MermaidDiagramProps {
  source: string;
}

/** Renders Mermaid source to an SVG, lazy-loading the library on first use. */
export function MermaidDiagram({ source }: MermaidDiagramProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [id] = useState(() => `mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;
    const code = source.trim();
    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
      if (hostRef.current) {
        hostRef.current.replaceChildren();
      }
      return;
    }
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const mermaid = (await import("mermaid")).default;
          const dark = document.documentElement.dataset.theme === "dark";
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: dark ? "dark" : "default",
          });
          const { svg } = await mermaid.render(id, code);
          if (!cancelled) {
            setError(null);
            if (hostRef.current) {
              const blob = new Blob([svg], { type: "image/svg+xml" });
              const objectUrl = URL.createObjectURL(blob);
              const img = document.createElement("img");
              img.alt = "Mermaid diagram";
              img.style.maxWidth = "100%";
              img.onload = () => URL.revokeObjectURL(objectUrl);
              img.onerror = () => URL.revokeObjectURL(objectUrl);
              img.src = objectUrl;
              hostRef.current.replaceChildren(img);
            }
          }
        } catch (renderError) {
          if (!cancelled) {
            setError(renderError instanceof Error ? renderError.message : String(renderError));
          }
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [id, source]);

  return (
    <div className="mermaid-diagram">
      {error ? (
        <pre className="mermaid-error" role="alert">
          {error}
        </pre>
      ) : (
        <div className="mermaid-svg" ref={hostRef} />
      )}
    </div>
  );
}
