import { CommandBus, EventBus } from "@notes/core";
import { APP_NAME } from "@notes/shared";
import { TomeWatcher, type TomeEventMap } from "@notes/tome";
import Fastify from "fastify";
import { registerFileCommands } from "./commands/file-commands";
import { loadConfig } from "./config";
import { registerErrorHandler } from "./errors";
import { createLoggingMiddleware, validationMiddleware } from "./middleware";
import { registerRoutes } from "./routes";
import { Tower } from "./tower";
import { registerWebSocket } from "./ws";

const config = loadConfig();
const app = Fastify({ logger: true });
registerErrorHandler(app);

const events = new EventBus<TomeEventMap>();
const tower = new Tower();
tower.openTome("default", config.tomePath);

const bus = new CommandBus();
bus.use(validationMiddleware);
bus.use(createLoggingMiddleware((message) => app.log.debug(message)));
registerFileCommands(bus, () => tower.active);

const ctx = { tomePath: config.tomePath };

app.get("/health", async () => ({
  status: "ok",
  app: APP_NAME,
  tomePath: config.tomePath,
}));

registerRoutes(app, bus, ctx);

const watcher = new TomeWatcher(config.tomePath, events);

async function main(): Promise<void> {
  try {
    await tower.active.ensureRoot();
    await registerWebSocket(app, events);
    watcher.start();
    const address = await app.listen({ host: config.host, port: config.port });
    app.log.info(`${APP_NAME} server listening at ${address}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
