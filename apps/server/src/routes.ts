import type { CommandBus, RequestContext } from "@notes/core";
import type { FastifyInstance } from "fastify";
import { listTomeThemes, getThemeCSS, importDefaultThemes } from "./commands/theme-commands";
import {
  listTomePlugins,
  getTomePluginScript,
  installPluginFromZip,
} from "./commands/plugin-commands";

interface PathQuery {
  path?: string;
}

const RAW_CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
};

function contentTypeForPath(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot === -1) {
    return "application/octet-stream";
  }
  const ext = path.slice(dot).toLowerCase();
  return RAW_CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** Maps REST endpoints onto command-bus dispatches. Routes never touch the FS directly. */
export function registerRoutes(app: FastifyInstance, bus: CommandBus, ctx: RequestContext): void {
  app.get("/api/files", async () => bus.dispatch("file.tree", {}, ctx));

  app.get("/api/file", async (request) => {
    const { path = "" } = request.query as PathQuery;
    const file = (await bus.dispatch("file.read", { path }, ctx)) as {
      path: string;
      contentBase64: string;
    };
    return { ...file, type: contentTypeForPath(path) };
  });

  app.put("/api/file", async (request) => bus.dispatch("file.write", request.body, ctx));

  app.post("/api/file", async (request) => bus.dispatch("file.create", request.body, ctx));

  app.post("/api/file/binary", async (request) =>
    bus.dispatch("file.createBinary", request.body, ctx),
  );

  app.get("/api/file/raw", async (request, reply) => {
    const { path = "" } = request.query as PathQuery;
    const file = (await bus.dispatch("file.readBinary", { path }, ctx)) as {
      path: string;
      contentBase64: string;
    };
    const bytes = Buffer.from(file.contentBase64, "base64");
    return reply.type(contentTypeForPath(path)).send(bytes);
  });

  app.post("/api/file/rename", async (request) => bus.dispatch("file.rename", request.body, ctx));

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
    const result = (await bus.dispatch("index.resolve", { text }, ctx)) as {
      path: string | null;
    };
    if (result.path) return result;
    // Fallback: treat `text` as a literal file path and check existence.
    // This allows embedding non-indexed files such as .json, .csv, etc.
    try {
      const exists = (await bus.dispatch("file.exists", { path: text }, ctx)) as {
        exists: boolean;
      };
      if (exists.exists) return { path: text };
    } catch {
      // Ignore
    }
    return { path: null };
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

  app.post("/api/card/create", async (request) => bus.dispatch("card.create", request.body, ctx));

  app.post("/api/card/update", async (request) => bus.dispatch("card.update", request.body, ctx));

  app.delete("/api/card", async (request) => {
    const { boardPath = "", cardId = "" } = request.query as {
      boardPath?: string;
      cardId?: string;
    };
    return bus.dispatch("card.delete", { boardPath, cardId }, ctx);
  });

  app.post("/api/card/move", async (request) => bus.dispatch("card.move", request.body, ctx));

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

  app.post("/api/event/create", async (request) => bus.dispatch("event.create", request.body, ctx));

  app.post("/api/event/update", async (request) => bus.dispatch("event.update", request.body, ctx));

  app.delete("/api/event", async (request) => {
    const { calendarPath = "", eventId = "" } = request.query as {
      calendarPath?: string;
      eventId?: string;
    };
    return bus.dispatch("event.delete", { calendarPath, eventId }, ctx);
  });

  // ── Themes ──────────────────────────────────────────────────────────────
  const tomePath = (ctx as { tomePath?: string }).tomePath ?? "";

  app.get("/api/themes", async () => {
    const themes = await listTomeThemes(tomePath);
    return { themes: themes.map((t) => t.meta) };
  });

  app.get("/api/themes/:id/style", async (request, reply) => {
    const { id } = request.params as { id: string };
    const css = await getThemeCSS(tomePath, id);
    if (!css) {
      return reply.status(404).send({ error: "Theme not found" });
    }
    return reply.type("text/css").send(css);
  });

  app.post("/api/themes/import-defaults", async () => {
    const imported = await importDefaultThemes(tomePath);
    return { imported };
  });

  // ── Tome Plugins ─────────────────────────────────────────────────────────
  app.get("/api/plugins", async () => {
    const { join } = await import("node:path");
    const entries = await listTomePlugins(tomePath);
    return {
      plugins: entries.map((e) => e.manifest),
      pluginsPath: join(tomePath, ".notes", "plugins"),
    };
  });

  app.get("/api/plugins/:id/client", async (request, reply) => {
    const { id } = request.params as { id: string };
    const script = await getTomePluginScript(tomePath, id);
    if (!script) {
      return reply.status(404).send({ error: "Plugin not found" });
    }
    return reply.type("application/javascript").send(script);
  });

  app.post("/api/plugins/install", async (request, reply) => {
    const body = request.body as { contentBase64?: string };
    if (!body.contentBase64) {
      return reply.status(400).send({ error: "contentBase64 is required" });
    }
    const zipBuffer = Buffer.from(body.contentBase64, "base64");
    const result = await installPluginFromZip(tomePath, zipBuffer);
    if (!result.ok) {
      return reply.status(422).send({ error: result.error });
    }
    return { manifest: result.manifest };
  });
}
