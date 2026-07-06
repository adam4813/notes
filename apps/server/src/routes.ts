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
}
