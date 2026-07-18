import { defineConfig, devices } from "@playwright/test";

const webPort = process.env.E2E_WEB_PORT ?? "3000";
const apiPort = process.env.E2E_API_PORT ?? "3101";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "tmp/playwright/test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/fixtures/workspace-api-server.mjs",
      url: `http://127.0.0.1:${apiPort}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `pnpm --filter @evaluation/web build && pnpm --filter @evaluation/web start --hostname 127.0.0.1 --port ${webPort}`,
      url: `http://127.0.0.1:${webPort}/ar`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        APP_ENV: "local",
        INTERNAL_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
        OIDC_SESSION_SECRET: "e2e-session-secret-with-at-least-32-characters",
        OIDC_ISSUER: "http://127.0.0.1:8081/realms/evaluation",
        OIDC_AUDIENCE: "evaluation-api",
        OIDC_CLIENT_ID: "evaluation-web",
        APP_BASE_URL: `http://127.0.0.1:${webPort}`,
        E2E_API_PORT: apiPort,
      },
    },
  ],
});
