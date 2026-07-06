import type { CommandBus } from "@notes/core";
import type { IndexService } from "../index-service";

interface SearchPayload {
  query: string;
  limit?: number;
}

interface PathPayload {
  path: string;
}

interface TagPayload {
  tag: string;
}

interface ResolvePayload {
  text: string;
}

/** Registers `index.*` query/maintenance commands backed by the NoteIndex. */
export function registerIndexCommands(bus: CommandBus, service: IndexService): void {
  bus.register<SearchPayload, unknown>({
    name: "index.search",
    handler: (payload) => ({ results: service.index.search(payload.query, payload.limit) }),
  });

  bus.register<PathPayload, unknown>({
    name: "index.backlinks",
    handler: (payload) => ({ backlinks: service.index.backlinksOf(payload.path) }),
  });

  bus.register<PathPayload, unknown>({
    name: "index.outgoing",
    handler: (payload) => ({ links: service.index.outgoingLinks(payload.path) }),
  });

  bus.register({
    name: "index.tags",
    handler: () => ({ tags: service.index.allTags() }),
  });

  bus.register<TagPayload, unknown>({
    name: "index.notesByTag",
    handler: (payload) => ({ paths: service.index.notesByTag(payload.tag) }),
  });

  bus.register<ResolvePayload, unknown>({
    name: "index.resolve",
    handler: (payload) => ({ path: service.index.resolveWikilink(payload.text) ?? null }),
  });

  bus.register({
    name: "index.rebuild",
    handler: async () => {
      await service.buildFromTome();
      return { rebuilt: true, notes: service.index.noteCount() };
    },
  });
}
