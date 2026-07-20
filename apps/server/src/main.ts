import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "node:net";
import { CommandBus, EventBus } from "@notes/core";
import { APP_NAME } from "@notes/shared";
import { TomeWatcher, type TomeEventMap } from "@notes/tome";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyRateLimit from "@fastify/rate-limit";
import { registerFileCommands } from "./commands/file-commands";
import { registerCardCommands } from "./commands/card-commands";
import { registerEventCommands } from "./commands/event-commands";
import { registerIndexCommands } from "./commands/index-commands";
import { registerNoteTypeCommands } from "./commands/note-type-commands";
import { loadConfig, type ServerConfig } from "./config";
import { registerErrorHandler } from "./errors";
import { IndexService } from "./index-service";
import { createLoggingMiddleware, validationMiddleware } from "./middleware";
import { registerRoutes } from "./routes";
import { Tower } from "./tower";
import { registerWebSocket } from "./ws";

/** Finds a free TCP port starting from the preferred port. */
async function findFreePort(preferred: number): Promise<number> {
  for (let port = preferred; port < preferred + 20; port++) {
    const free = await new Promise<boolean>((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      server.listen(port, "127.0.0.1");
    });
    if (free) return port;
  }
  throw new Error(`No free port found in range ${preferred}–${preferred + 19}`);
}

export interface StartServerResult {
  port: number;
  address: string;
}

/**
 * Starts the Fastify server. Accepts optional config overrides so that
 * Electron (production) can pass a custom tomePath from electron-store.
 * Returns the actual port bound (may differ from config if port was busy).
 */
export async function startServer(overrides?: Partial<ServerConfig>): Promise<StartServerResult> {
  const config = { ...loadConfig(), ...overrides };
  const app = Fastify({ logger: true, bodyLimit: 10485760 });
  registerErrorHandler(app);
  await app.register(fastifyRateLimit, { max: 300, timeWindow: "1 minute" });

  const events = new EventBus<TomeEventMap>();
  const tower = new Tower();
  tower.openTome("default", config.tomePath);

  const bus = new CommandBus();
  bus.use(validationMiddleware);
  bus.use(createLoggingMiddleware((message) => app.log.debug(message)));
  registerFileCommands(bus, () => tower.active);
  registerCardCommands(bus, () => tower.active);
  registerEventCommands(bus, () => tower.active);
  registerNoteTypeCommands(bus, () => tower.active);

  const ctx = { tomePath: config.tomePath };

  app.get("/health", async () => ({
    status: "ok",
    app: APP_NAME,
    tomePath: config.tomePath,
  }));

  // In production (Electron packaged), serve the React web UI from the same
  // origin so that /api and /ws requests work without CORS or file:// issues.
  if (process.env["NOTES_PACKAGED"] === "1" && process.env["NOTES_WEB_DIST"]) {
    await app.register(fastifyStatic, {
      root: process.env["NOTES_WEB_DIST"],
      prefix: "/",
    });
  }

  const watcher = new TomeWatcher(config.tomePath, events);

  try {
    await tower.active.ensureRoot();

    const indexService = await IndexService.create(
      tower.active,
      events,
      join(config.tomePath, ".notes", "index.db"),
    );
    await indexService.buildFromTome();
    indexService.subscribe();
    registerIndexCommands(bus, indexService);

    registerRoutes(app, bus, ctx);

    await registerWebSocket(app, events);
    watcher.start();

    const port = await findFreePort(config.port);
    const address = await app.listen({ host: config.host, port });
    app.log.info(
      `${APP_NAME} server listening at ${address} (indexed ${indexService.index.noteCount()} notes)`,
    );
    return { port, address };
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

// Only auto-start when this file is run directly (not imported by Electron).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startServer();
}
