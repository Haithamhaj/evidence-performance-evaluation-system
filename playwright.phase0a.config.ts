import { defineConfig, devices } from "@playwright/test";

const prototypePort = process.env.PHASE0A_PORT ?? "4173";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "ai-native-phase-0a-prototype.spec.ts",
  outputDir: "tmp/playwright/phase0a-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${prototypePort}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node scripts/serve-ai-native-phase-0a-prototype.mjs --port ${prototypePort}`,
    url: `http://127.0.0.1:${prototypePort}/health`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
