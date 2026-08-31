import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = "5175";
const WEB_URL = `http://localhost:${WEB_PORT}`;
const SERVER_PORT = "8789";
const SERVER_HEALTH = `http://127.0.0.1:${SERVER_PORT}/health`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 5_000,
  fullyParallel: false,
  workers: 1,
  // The suite shares one Tome and exercises debounced autosave + a file watcher;
  // allow a couple of retries to absorb inherent filesystem-event timing.
  retries: 3,
  use: {
    baseURL: WEB_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev:server",
      url: SERVER_HEALTH,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { NOTES_TOME: "e2e-tome", NOTES_PORT: SERVER_PORT, WEB_PORT },
    },
    {
      command: "npm run dev:web",
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { WEB_PORT, NOTES_PORT: SERVER_PORT },
    },
  ],
});
