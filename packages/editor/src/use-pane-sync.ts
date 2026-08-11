/**
 * Pane synchronisation hooks for the split editor.
 *
 * All three sync types (cursor, scroll, focus) share the same token-based
 * request pattern: a state object with a `token` that increments on each
 * new request, letting receiving panes distinguish a new request from a
 * repeated render via `useEffect([…, request.token])`.
 *
 * `usePaneSync` is the generic base. `useCursorSync`, `useScrollSync`, and
 * `useFocusSync` are the three specializations used by the editor shell and
 * return the concrete request types consumed by `RendererProps`.
 */
import { useCallback, useState } from "react";
import type { CursorRequest, ScrollRequest, FocusRequest } from "./types";

// ── Generic base ──────────────────────────────────────────────────────────────

/** Incrementing token that distinguishes new requests from repeated renders. */
let globalToken = 1;
function nextToken(): number {
  return globalToken++;
}

export interface SyncRequest<T> {
  token: number;
  value: T;
}

/**
 * Generic hook for one direction of pane synchronisation.
 * `initialValue` seeds the first request.
 */
export function usePaneSync<T>(initialValue: T): {
  request: SyncRequest<T>;
  send: (value: T) => void;
} {
  const [request, setRequest] = useState<SyncRequest<T>>({ token: 0, value: initialValue });
  const send = useCallback((value: T) => setRequest({ token: nextToken(), value }), []);
  return { request, send };
}

// ── Cursor sync ───────────────────────────────────────────────────────────────

export interface CursorSyncResult {
  /** Deliver to the receiving pane as the `cursorRequest` prop. */
  request: CursorRequest;
  /** Call with the new cursor position to send a request to the other pane. */
  send: (position: number) => void;
}

/** Manages cursor-position synchronisation from one pane to another. */
export function useCursorSync(initialPosition = 0): CursorSyncResult {
  const [request, setRequest] = useState<CursorRequest>({ token: 0, position: initialPosition });
  const send = useCallback((position: number) => setRequest({ token: nextToken(), position }), []);
  return { request, send };
}

// ── Scroll sync ───────────────────────────────────────────────────────────────

export interface ScrollSyncResult {
  /** Deliver to the receiving pane as the `scrollRequest` prop. */
  request: ScrollRequest;
  /** Call with a scroll ratio (0–1) to send a request to the other pane. */
  send: (ratio: number) => void;
}

/** Manages scroll-ratio synchronisation from one pane to another. */
export function useScrollSync(initialRatio = 0): ScrollSyncResult {
  const [request, setRequest] = useState<ScrollRequest>({ token: 0, ratio: initialRatio });
  const send = useCallback((ratio: number) => setRequest({ token: nextToken(), ratio }), []);
  return { request, send };
}

// ── Focus sync ────────────────────────────────────────────────────────────────

export interface FocusSyncResult {
  /** Deliver to the receiving pane as the `focusRequest` prop. */
  request: FocusRequest;
  /** Call to request that the receiving pane is focused. */
  send: () => void;
}

/** Manages focus requests from one pane to another. */
export function useFocusSync(initialToken = 0): FocusSyncResult {
  const [request, setRequest] = useState<FocusRequest>({ token: initialToken });
  const send = useCallback(() => setRequest({ token: nextToken() }), []);
  return { request, send };
}
