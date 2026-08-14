import { describe, expect, it } from "vitest";

import { registerProgressContractDraftAiRoute } from "./register-progress-contract-draft-ai-route.js";

describe("Progress Contract AI draft route registration", () => {
  it("plans the system-level GPT-5.5 structured-output route without provider credentials", async () => {
    await expect(registerProgressContractDraftAiRoute({ dryRun: true })).resolves.toMatchObject({
      routeKey: "project.progress-contract.draft",
      modelKey: "gpt-5.5-2026-04-23",
      providerEndpoint: "https://api.openai.com/v1",
      promptVersion: "project-progress-contract-draft.v3",
      outputSchemaVersion: "project-progress-contract-draft.v1",
    });
  });
});
