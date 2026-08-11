import path from "node:path";
import { fileURLToPath } from "node:url";

import { playwright } from "@vitest/browser-playwright";
import { defineProject } from "vitest/config";

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));

export default [
  defineProject({
    test: {
      name: "unit",
      include: [
        "tests/repository/**/*.test.ts",
        "tests/performance/**/*.test.ts",
        "apps/**/*.test.{ts,tsx}",
        "packages/**/*.test.{ts,tsx}",
        "scripts/**/*.test.ts",
      ],
      exclude: ["**/node_modules/**", "**/*.integration.test.ts", "**/*.storybook.test.tsx"],
    },
  }),
  defineProject({
    test: {
      name: "integration",
      fileParallelism: false,
      include: [
        "tests/integration/**/*.test.ts",
        "tests/performance/**/*.integration.test.ts",
        "apps/**/*.integration.test.ts",
        "packages/**/*.integration.test.ts",
        "scripts/**/*.integration.test.ts",
      ],
    },
  }),
  defineProject({
    test: {
      name: "ai-evals",
      include: ["tests/ai-evals/**/*.test.ts", "tests/ai/**/*.eval.test.ts"],
    },
  }),
  defineProject({
    test: {
      browser: {
        enabled: true,
        headless: true,
        instances: [{ browser: "chromium" }],
        provider: playwright({}),
      },
      include: ["apps/web/src/**/*.storybook.test.tsx"],
      name: "storybook",
      setupFiles: [path.join(repositoryRoot, "apps/web/.storybook/vitest.setup.ts")],
    },
  }),
];
