export type EventListener<TPayload> = (payload: TPayload) => void | Promise<void>;

/**
 * Minimal typed publish/subscribe bus (Observer pattern). Event maps are
 * `Record<eventName, payloadType>`.
 */
export class EventBus<TEventMap extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof TEventMap, Set<EventListener<unknown>>>();

  on<TKey extends keyof TEventMap>(
    type: TKey,
    listener: EventListener<TEventMap[TKey]>,
  ): () => void {
    const set = this.listeners.get(type) ?? new Set<EventListener<unknown>>();
    set.add(listener as EventListener<unknown>);
    this.listeners.set(type, set);
    return () => this.off(type, listener);
  }

  off<TKey extends keyof TEventMap>(type: TKey, listener: EventListener<TEventMap[TKey]>): void {
    this.listeners.get(type)?.delete(listener as EventListener<unknown>);
  }

  async emit<TKey extends keyof TEventMap>(type: TKey, payload: TEventMap[TKey]): Promise<void> {
    const set = this.listeners.get(type);
    if (!set) {
      return;
    }
    const results: Promise<void>[] = [];
    for (const listener of [...set]) {
      const result = (listener as EventListener<TEventMap[TKey]>)(payload);
      if (result instanceof Promise) {
        results.push(result);
      }
    }
    await Promise.all(results);
  }
}
