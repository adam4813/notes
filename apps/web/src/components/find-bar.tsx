import { useEffect, useRef, useState, type RefObject } from "react";
import { replaceAll, replaceMatch } from "../lib/find";

interface FindBarProps {
  /** The editor region whose visible text is searched and highlighted. */
  regionRef: RefObject<HTMLElement>;
  /** Current markdown source, used for replace operations. */
  content: string;
  onReplace: (next: string) => void;
  onClose: () => void;
}

interface DomMatch {
  node: Text;
  start: number;
  end: number;
}

const HIGHLIGHT = "note-find";
const HIGHLIGHT_CURRENT = "note-find-current";

/** Collects text-node ranges in `root` matching `query` (case-insensitive). */
function collectMatches(root: HTMLElement, query: string): DomMatch[] {
  if (!query) {
    return [];
  }
  const needle = query.toLowerCase();
  const matches: DomMatch[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const text = node.data.toLowerCase();
    let from = 0;
    for (;;) {
      const index = text.indexOf(needle, from);
      if (index === -1) {
        break;
      }
      matches.push({ node, start: index, end: index + needle.length });
      from = index + needle.length;
    }
    node = walker.nextNode() as Text | null;
  }
  return matches;
}

// The CSS Custom Highlight API is not in older TS DOM libs; declare what we use.
interface HighlightRegistry {
  set: (name: string, highlight: unknown) => void;
  delete: (name: string) => void;
}
declare const Highlight: { new (...ranges: Range[]): unknown };

function highlightsApi(): HighlightRegistry | undefined {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  return css?.highlights;
}

export function FindBar({ regionRef, content, onReplace, onClose }: FindBarProps) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Recompute matches + highlights whenever the query or content changes.
  useEffect(() => {
    const region = regionRef.current;
    const api = highlightsApi();
    if (!region) {
      return;
    }
    const matches = collectMatches(region, query);
    setCount(matches.length);
    const index = matches.length === 0 ? 0 : Math.min(current, matches.length - 1);
    if (current !== index) {
      setCurrent(index);
    }

    if (!api || typeof Highlight === "undefined") {
      return;
    }
    if (matches.length === 0) {
      api.delete(HIGHLIGHT);
      api.delete(HIGHLIGHT_CURRENT);
      return;
    }
    const ranges = matches.map((match) => {
      const range = document.createRange();
      range.setStart(match.node, match.start);
      range.setEnd(match.node, match.end);
      return range;
    });
    api.set(HIGHLIGHT, new Highlight(...ranges));
    const activeRange = ranges[index];
    if (activeRange) {
      api.set(HIGHLIGHT_CURRENT, new Highlight(activeRange));
      activeRange.startContainer.parentElement?.scrollIntoView({ block: "center" });
    }
  }, [query, content, current, regionRef]);

  // Clear highlights on unmount.
  useEffect(() => {
    return () => {
      const api = highlightsApi();
      api?.delete(HIGHLIGHT);
      api?.delete(HIGHLIGHT_CURRENT);
    };
  }, []);

  const step = (delta: number) => {
    if (count === 0) {
      return;
    }
    setCurrent((index) => (index + delta + count) % count);
  };

  const doReplace = () => {
    if (count === 0) {
      return;
    }
    onReplace(replaceMatch(content, query, current, replacement));
  };

  const doReplaceAll = () => {
    if (count === 0) {
      return;
    }
    onReplace(replaceAll(content, query, replacement));
  };

  return (
    <div className="find-bar" role="search">
      <button
        className="find-toggle"
        aria-label={showReplace ? "Hide replace" : "Show replace"}
        onClick={() => setShowReplace((value) => !value)}
      >
        {showReplace ? "▾" : "▸"}
      </button>
      <div className="find-rows">
        <div className="find-row">
          <input
            ref={inputRef}
            className="find-input"
            data-testid="find-input"
            placeholder="Find"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                step(event.shiftKey ? -1 : 1);
              } else if (event.key === "Escape") {
                onClose();
              }
            }}
          />
          <span className="find-count" data-testid="find-count">
            {count === 0 ? "0/0" : `${current + 1}/${count}`}
          </span>
          <button className="find-nav" aria-label="Previous match" onClick={() => step(-1)}>
            ↑
          </button>
          <button className="find-nav" aria-label="Next match" onClick={() => step(1)}>
            ↓
          </button>
          <button className="find-nav" aria-label="Close find" onClick={onClose}>
            ×
          </button>
        </div>
        {showReplace && (
          <div className="find-row">
            <input
              className="find-input"
              data-testid="replace-input"
              placeholder="Replace"
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
            />
            <button className="find-action" onClick={doReplace}>
              Replace
            </button>
            <button className="find-action" data-testid="replace-all" onClick={doReplaceAll}>
              All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
