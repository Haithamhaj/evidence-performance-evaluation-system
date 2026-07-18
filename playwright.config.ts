import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "tmp/playwright/test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/fixtures/workspace-api-server.mjs",
      url: "http://127.0.0.1:3101/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        "pnpm --filter @evaluation/web build && pnpm --filter @evaluation/web start --hostname 127.0.0.1 --port 3000",
      url: "http://127.0.0.1:3000/ar",
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        APP_ENV: "local",
        INTERNAL_API_BASE_URL: "http://127.0.0.1:3101",
        OIDC_SESSION_SECRET: "e2e-session-secret-with-at-least-32-characters",
        OIDC_ISSUER: "http://127.0.0.1:8081/realms/evaluation",
        OIDC_AUDIENCE: "evaluation-api",
        OIDC_CLIENT_ID: "evaluation-web",
        APP_BASE_URL: "http://127.0.0.1:3000",
      },
    },
  ],
});
