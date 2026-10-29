import { useCallback, useEffect, useRef, useState } from "react";
import {
  type LogEntry,
  type LogLevel,
  clearLog,
  getLogEntries,
  MAX_LOG_ENTRIES,
  onClear,
  onLog,
} from "@notes/shared";
import "./console-pane.css";

const LEVEL_ORDER: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`console-entry console-entry--${entry.level}`}>
      <span className="console-entry__time">{formatTime(entry.timestamp)}</span>
      <span className={`console-entry__level console-entry__level--${entry.level}`}>
        {entry.level}
      </span>
      <span className="console-entry__source">{entry.source}</span>
      <div className="console-entry__body">
        <span className="console-entry__message">{entry.message}</span>
        {entry.stack && (
          <button
            className="console-entry__expand-btn"
            aria-label={expanded ? "Collapse stack trace" : "Expand stack trace"}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "▲" : "▼"}
          </button>
        )}
        {expanded && entry.stack && (
          <pre className="console-entry__stack">{entry.stack}</pre>
        )}
      </div>
    </div>
  );
}

const FILTER_LEVELS: { level: LogLevel; label: string }[] = [
  { level: "error", label: "Errors" },
  { level: "warn", label: "Warnings" },
  { level: "info", label: "Info" },
];

export function ConsolePane({
  open,
  height,
  onClose,
  onHeightChange,
}: {
  open: boolean;
  height: number;
  onClose: () => void;
  onHeightChange: (h: number) => void;
}) {
  const [entries, setEntries] = useState<LogEntry[]>(() => [...getLogEntries()]);
  const [activeFilters, setActiveFilters] = useState<Set<LogLevel>>(
    () => new Set(["error", "warn", "info"]),
  );
  const [verbose, setVerbose] = useState(false);
  const [dragging, setDragging] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Subscribe to new entries and clears
  useEffect(() => {
    const unsubLog = onLog((entry) => {
      setEntries((prev) => {
        const next = [...prev, entry];
        return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
      });
    });
    const unsubClear = onClear(() => setEntries([]));
    return () => {
      unsubLog();
      unsubClear();
    };
  }, []);

  // Auto-scroll to bottom on new entries (only when scrolled near the bottom)
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries]);

  // Drag handle handlers
  const handleDragDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { startY: e.clientY, startH: height };
      setDragging(true);
    },
    [height],
  );

  const handleDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const { startY, startH } = dragRef.current;
    const delta = startY - e.clientY;
    const newH = Math.max(80, Math.min(window.innerHeight * 0.5, startH + delta));
    // Update height directly on DOM elements for smooth drag without re-renders
    if (paneRef.current) paneRef.current.style.height = `${newH}px`;
    const shell = paneRef.current?.closest<HTMLElement>(".shell");
    if (shell) shell.style.setProperty("--console-h", `${newH}px`);
  }, []);

  const handleDragUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      const { startY, startH } = dragRef.current;
      const delta = startY - e.clientY;
      const newH = Math.max(80, Math.min(window.innerHeight * 0.5, startH + delta));
      dragRef.current = null;
      setDragging(false);
      onHeightChange(newH);
    },
    [onHeightChange],
  );

  const toggleFilter = useCallback((level: LogLevel) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }, []);

  const visibleEntries = entries.filter((e) => {
    if (e.level === "debug" && !verbose) return false;
    return activeFilters.has(e.level);
  });

  // Sort by timestamp (buffer is already ordered, but be safe)
  visibleEntries.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.timestamp - b.timestamp);

  if (!open) return null;

  return (
    <div
      className="console-pane"
      ref={paneRef}
      style={{ height }}
      aria-label="Console"
      role="log"
    >
      <div
        className={`console-drag-handle${dragging ? " console-drag-handle--dragging" : ""}`}
        onPointerDown={handleDragDown}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragUp}
        aria-hidden="true"
      />
      <div className="console-header">
        <span className="console-title">Console</span>
        {FILTER_LEVELS.map(({ level, label }) => (
          <button
            key={level}
            className={`console-chip console-chip--${level}${activeFilters.has(level) ? " console-chip--active" : ""}`}
            onClick={() => toggleFilter(level)}
            aria-pressed={activeFilters.has(level)}
          >
            {label}
          </button>
        ))}
        <button
          className={`console-chip${verbose ? " console-chip--active" : ""}`}
          onClick={() => setVerbose((v) => !v)}
          aria-pressed={verbose}
        >
          Verbose
        </button>
        <span className="console-spacer" />
        <button
          className="console-header-btn"
          onClick={clearLog}
          aria-label="Clear console"
        >
          Clear
        </button>
        {/* TODO: Add "Preserve until app close" toggle here */}
        <button
          className="console-header-btn console-close-btn"
          onClick={onClose}
          aria-label="Close console"
        >
          ✕
        </button>
      </div>
      <div className="console-body" ref={bodyRef}>
        {visibleEntries.length === 0 ? (
          <div className="console-empty">No messages</div>
        ) : (
          visibleEntries.map((entry) => <LogEntryRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
