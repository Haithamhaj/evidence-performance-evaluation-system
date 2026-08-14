import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { registerGpt56RoutingPolicy } from "./register-gpt-5-6-routing-policy.js";

describe("GPT-5.6 routing policy registration", () => {
  it("returns a credential-free dry-run plan for all three tiers", async () => {
    const plan = await registerGpt56RoutingPolicy({ dryRun: true });

    expect(plan.policyVersion).toBe("gpt-5.6-cost-quality.v1");
    expect(plan.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tier: "luna", models: expect.arrayContaining(["gpt-5.6-luna"]) }),
        expect.objectContaining({
          tier: "terra",
          models: expect.arrayContaining(["gpt-5.6-terra"]),
        }),
        expect.objectContaining({ tier: "sol", models: expect.arrayContaining(["gpt-5.6-sol"]) }),
      ]),
    );
    expect(JSON.stringify(plan)).not.toMatch(/credential|api[_-]?key|token/iu);
  });

  it("requires authorized audit context outside dry-run", async () => {
    await expect(registerGpt56RoutingPolicy({ dryRun: false })).rejects.toMatchObject({
      code: "AI_ROUTE_REGISTRATION_CONTEXT_REQUIRED",
    });
  });

  it("exposes the governed registration command", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["ai:register:gpt-5-6-policy"]).toBe(
      "tsx scripts/register-gpt-5-6-routing-policy.ts",
    );
  });
});
