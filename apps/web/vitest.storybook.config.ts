import path from "node:path";
import { fileURLToPath } from "node:url";

import { playwright } from "@vitest/browser-playwright";
import { defineProject } from "vitest/config";

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineProject({
  root: path.resolve(directory, "../.."),
  test: {
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright({}),
    },
    include: ["apps/web/src/**/*.storybook.test.tsx"],
    name: "storybook",
    setupFiles: [path.join(directory, ".storybook/vitest.setup.ts")],
  },
});
