import type { CommandBus, RequestContext } from "@notes/core";
import type { FastifyInstance } from "fastify";

interface PathQuery {
  path?: string;
}

/** Maps REST endpoints onto command-bus dispatches. Routes never touch the FS directly. */
export function registerRoutes(app: FastifyInstance, bus: CommandBus, ctx: RequestContext): void {
  app.get("/api/files", async () => bus.dispatch("file.tree", {}, ctx));

  app.get("/api/file", async (request) => {
    const { path = "" } = request.query as PathQuery;
    return bus.dispatch("file.read", { path }, ctx);
  });

  app.put("/api/file", async (request) => bus.dispatch("file.write", request.body, ctx));

  app.post("/api/file", async (request) => bus.dispatch("file.create", request.body, ctx));

  app.post("/api/file/rename", async (request) =>
    bus.dispatch("file.rename", request.body, ctx),
  );

  app.post("/api/file/move", async (request) => bus.dispatch("file.move", request.body, ctx));

  app.delete("/api/file", async (request) => {
    const { path = "" } = request.query as PathQuery;
    return bus.dispatch("file.delete", { path }, ctx);
  });

  app.get("/api/search", async (request) => {
    const query = request.query as { q?: string; limit?: string };
    return bus.dispatch(
      "index.search",
      { query: query.q ?? "", limit: query.limit ? Number(query.limit) : undefined },
      ctx,
    );
  });

  app.get("/api/backlinks", async (request) => {
    const { path = "" } = request.query as PathQuery;
    return bus.dispatch("index.backlinks", { path }, ctx);
  });

  app.get("/api/outgoing", async (request) => {
    const { path = "" } = request.query as PathQuery;
    return bus.dispatch("index.outgoing", { path }, ctx);
  });

  app.get("/api/tags", async () => bus.dispatch("index.tags", {}, ctx));

  app.get("/api/notes", async () => bus.dispatch("index.notes", {}, ctx));

  app.get("/api/tag", async (request) => {
    const { tag = "" } = request.query as { tag?: string };
    return bus.dispatch("index.notesByTag", { tag }, ctx);
  });

  app.get("/api/resolve", async (request) => {
    const { text = "" } = request.query as { text?: string };
    return bus.dispatch("index.resolve", { text }, ctx);
  });

  app.post("/api/reindex", async () => bus.dispatch("index.rebuild", {}, ctx));
}
