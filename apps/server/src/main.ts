import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { CommandBus, EventBus } from "@notes/core";
import { APP_NAME } from "@notes/shared";
import { TomeWatcher, type TomeEventMap } from "@notes/tome";
import Fastify from "fastify";
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

/**
 * Starts the Fastify server. Accepts optional config overrides so that
 * Electron (production) can pass a custom tomePath from electron-store.
 */
export async function startServer(overrides?: Partial<ServerConfig>): Promise<void> {
  const config = { ...loadConfig(), ...overrides };
  const app = Fastify({ logger: true });
  registerErrorHandler(app);

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

    const address = await app.listen({ host: config.host, port: config.port });
    app.log.info(
      `${APP_NAME} server listening at ${address} (indexed ${indexService.index.noteCount()} notes)`,
    );
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

// Only auto-start when this file is run directly (not imported by Electron).
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void startServer();
}
