/** Generic id-keyed registry backing every extension point. */
export class Registry<TItem> {
  private readonly items = new Map<string, TItem>();

  register(id: string, item: TItem): void {
    if (this.items.has(id)) {
      throw new Error(`Registry already contains an item with id "${id}"`);
    }
    this.items.set(id, item);
  }

  unregister(id: string): boolean {
    return this.items.delete(id);
  }

  get(id: string): TItem | undefined {
    return this.items.get(id);
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  list(): TItem[] {
    return [...this.items.values()];
  }

  ids(): string[] {
    return [...this.items.keys()];
  }
}
