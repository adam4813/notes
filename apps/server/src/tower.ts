import { Tome } from "@notes/tome";

/**
 * Session that holds the open Tome(s). MVP keeps a single active Tome, but the
 * structure (id-keyed map) is ready to hold multiple Tomes later.
 */
export class Tower {
  private readonly tomes = new Map<string, Tome>();
  private activeId?: string;

  openTome(id: string, root: string): Tome {
    const tome = new Tome(root);
    this.tomes.set(id, tome);
    this.activeId ??= id;
    return tome;
  }

  get active(): Tome {
    if (!this.activeId) {
      throw new Error("No active Tome is open");
    }
    const tome = this.tomes.get(this.activeId);
    if (!tome) {
      throw new Error(`Active Tome "${this.activeId}" is missing`);
    }
    return tome;
  }
}
