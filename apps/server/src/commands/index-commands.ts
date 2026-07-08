import type { CommandBus } from "@notes/core";
import type { IndexService } from "../index-service";

interface SearchPayload {
  query: string;
  limit?: number;
  tag?: string;
  type?: string;
  pathPrefix?: string;
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
    handler: (payload) => ({
      results: service.index.search(payload.query, payload.limit ?? 50, {
        ...(payload.tag ? { tag: payload.tag } : {}),
        ...(payload.type ? { type: payload.type } : {}),
        ...(payload.pathPrefix ? { pathPrefix: payload.pathPrefix } : {}),
      }),
    }),
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

  bus.register({
    name: "index.notes",
    handler: () => ({ notes: service.index.allNotes() }),
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
