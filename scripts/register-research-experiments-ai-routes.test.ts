import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { registerResearchExperimentsAiRoutes } from "./register-research-experiments-ai-routes.js";

describe("Research & Experiments AI route registration", () => {
  it("plans exactly five governed prompt/schema artifacts without provider configuration", async () => {
    const plan = await registerResearchExperimentsAiRoutes({ dryRun: true });

    expect(plan.routes.map(({ routeKey }) => routeKey)).toEqual([
      "research.source-review.v1",
      "research.frame.v1",
      "research.synthesize.v1",
      "experiment.method-review.v1",
      "experiment.interpret.v1",
    ]);
    expect(plan.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          promptVersion: expect.stringMatching(/\.v1$/u),
          outputSchemaVersion: expect.stringMatching(/\.v1$/u),
          promptHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
          outputSchemaHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        }),
      ]),
    );
    expect(JSON.stringify(plan)).not.toMatch(/provider|endpoint|credential|token/iu);
  });

  it("requires authorized registration context outside dry-run", async () => {
    await expect(registerResearchExperimentsAiRoutes({ dryRun: false })).rejects.toMatchObject({
      code: "AI_ROUTE_REGISTRATION_CONTEXT_REQUIRED",
    });
  });

  it("wires a package script for explicit route registration", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(packageJson.scripts["ai:register:research-experiments"]).toBe(
      "tsx scripts/register-research-experiments-ai-routes.ts",
    );
  });
});
