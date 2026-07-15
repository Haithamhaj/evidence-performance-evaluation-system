import { defineProject } from "vitest/config";

export default [
  defineProject({
    test: {
      name: "unit",
      include: ["tests/repository/**/*.test.ts", "apps/**/*.test.ts", "packages/**/*.test.ts"],
      exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
    },
  }),
  defineProject({
    test: {
      name: "integration",
      fileParallelism: false,
      include: [
        "tests/integration/**/*.test.ts",
        "apps/**/*.integration.test.ts",
        "packages/**/*.integration.test.ts",
      ],
    },
  }),
  defineProject({
    test: {
      name: "ai-evals",
      include: ["tests/ai-evals/**/*.test.ts"],
    },
  }),
];
