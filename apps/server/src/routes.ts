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

  app.post("/api/folder", async (request) => bus.dispatch("file.mkdir", request.body, ctx));

  app.get("/api/search", async (request) => {
    const query = request.query as {
      q?: string;
      limit?: string;
      tag?: string;
      type?: string;
      path?: string;
    };
    return bus.dispatch(
      "index.search",
      {
        query: query.q ?? "",
        limit: query.limit ? Number(query.limit) : undefined,
        ...(query.tag ? { tag: query.tag } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.path ? { pathPrefix: query.path } : {}),
      },
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

  app.get("/api/tome", async () => ({ id: (ctx as { tomePath?: string }).tomePath ?? "default" }));

  app.get("/api/notetype", async (request) => {
    const { path = "" } = request.query as PathQuery;
    return bus.dispatch("note.detectType", { path }, ctx);
  });

  // Card CRUD (board rich cards)
  app.get("/api/cards", async (request) => {
    const { boardPath = "" } = request.query as { boardPath?: string };
    return bus.dispatch("card.list", { boardPath }, ctx);
  });

  app.get("/api/card", async (request) => {
    const { boardPath = "", cardId = "" } = request.query as {
      boardPath?: string;
      cardId?: string;
    };
    return bus.dispatch("card.get", { boardPath, cardId }, ctx);
  });

  app.post("/api/card/create", async (request) =>
    bus.dispatch("card.create", request.body, ctx),
  );

  app.post("/api/card/update", async (request) =>
    bus.dispatch("card.update", request.body, ctx),
  );

  app.delete("/api/card", async (request) => {
    const { boardPath = "", cardId = "" } = request.query as {
      boardPath?: string;
      cardId?: string;
    };
    return bus.dispatch("card.delete", { boardPath, cardId }, ctx);
  });

  app.post("/api/card/move", async (request) =>
    bus.dispatch("card.move", request.body, ctx),
  );

  // Event CRUD (calendar rich entries)
  app.get("/api/events", async (request) => {
    const { calendarPath = "" } = request.query as { calendarPath?: string };
    return bus.dispatch("event.list", { calendarPath }, ctx);
  });

  app.get("/api/event", async (request) => {
    const { calendarPath = "", eventId = "" } = request.query as {
      calendarPath?: string;
      eventId?: string;
    };
    return bus.dispatch("event.get", { calendarPath, eventId }, ctx);
  });

  app.post("/api/event/create", async (request) =>
    bus.dispatch("event.create", request.body, ctx),
  );

  app.post("/api/event/update", async (request) =>
    bus.dispatch("event.update", request.body, ctx),
  );

  app.delete("/api/event", async (request) => {
    const { calendarPath = "", eventId = "" } = request.query as {
      calendarPath?: string;
      eventId?: string;
    };
    return bus.dispatch("event.delete", { calendarPath, eventId }, ctx);
  });
}
