import { describe, expect, it } from "vitest";

import { GPT_5_6_MODELS, gpt56ProviderOrder, gpt56TierForRoute } from "./gpt-5-6-routing-policy.js";

describe("GPT-5.6 routing policy", () => {
  it("uses Luna for frequent bounded preparation", () => {
    expect(gpt56TierForRoute("experience.prepare-next.v1")).toBe("luna");
    expect(gpt56ProviderOrder("experience.prepare-next.v1")).toEqual([
      GPT_5_6_MODELS.luna,
      GPT_5_6_MODELS.terra,
      GPT_5_6_MODELS.sol,
    ]);
  });

  it("uses Terra for daily employee assistance", () => {
    expect(gpt56TierForRoute("update.structure")).toBe("terra");
    expect(gpt56TierForRoute("experience.capture-understand.v1")).toBe("terra");
    expect(gpt56ProviderOrder("experience.task-assistant.v1")).toEqual([
      GPT_5_6_MODELS.terra,
      GPT_5_6_MODELS.sol,
      GPT_5_6_MODELS.luna,
    ]);
  });

  it("uses Sol for complex or high-impact analysis", () => {
    expect(gpt56TierForRoute("project.progress-contract.draft")).toBe("sol");
    expect(gpt56TierForRoute("research.synthesize.v1")).toBe("sol");
    expect(gpt56ProviderOrder("project.progress-contract.draft")).toEqual([
      GPT_5_6_MODELS.sol,
      GPT_5_6_MODELS.terra,
    ]);
  });

  it("does not replace specialized audio routes", () => {
    expect(gpt56TierForRoute("update.transcribe")).toBeNull();
    expect(gpt56ProviderOrder("update.transcribe")).toEqual([]);
  });
});
