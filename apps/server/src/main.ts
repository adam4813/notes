import Fastify from "fastify";
import { APP_NAME } from "@notes/shared";
import { loadConfig } from "./config";
import { createPlaceholderCommandBus } from "./command-bus";

const config = loadConfig();
const app = Fastify({ logger: true });

// The real command bus arrives in Phase 1; instantiate the placeholder so the
// wiring is in place and exercised.
const commandBus = createPlaceholderCommandBus();
void commandBus;

app.get("/health", async () => ({
  status: "ok",
  app: APP_NAME,
  tomePath: config.tomePath,
}));

async function main(): Promise<void> {
  try {
    const address = await app.listen({ host: config.host, port: config.port });
    app.log.info(`${APP_NAME} server listening at ${address}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
