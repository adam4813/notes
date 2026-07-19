import { useEffect, useState, type RefObject } from "react";

export interface VirtualWindow {
  /** First item index to render (inclusive). */
  start: number;
  /** Last item index to render (exclusive). */
  end: number;
  /** Total scrollable height in px. */
  totalHeight: number;
  /** Top offset in px for the first rendered item. */
  offsetY: number;
  onScroll: () => void;
}

/**
 * Minimal fixed-height windowing for long lists. Renders only the rows visible
 * in `scrollRef` (plus overscan), so an explorer/list with thousands of rows
 * stays fast. No dependency required.
 */
export function useVirtual(
  count: number,
  itemHeight: number,
  scrollRef: RefObject<HTMLElement | null>,
  overscan = 10,
): VirtualWindow {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(800);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const measure = () => setViewport(element.clientHeight || 800);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRef]);

  const onScroll = () => {
    const element = scrollRef.current;
    if (element) {
      setScrollTop(element.scrollTop);
    }
  };

  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const end = Math.min(count, Math.ceil((scrollTop + viewport) / itemHeight) + overscan);
  return { start, end, totalHeight: count * itemHeight, offsetY: start * itemHeight, onScroll };
}
