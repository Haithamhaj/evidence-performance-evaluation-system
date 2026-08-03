import { describe, expect, it } from "vitest";

import { registerUpdateTranscribeAiRoute } from "./register-update-transcribe-ai-route.js";

describe("registerUpdateTranscribeAiRoute", () => {
  it("produces a credential-free governed dry-run plan", async () => {
    const plan = await registerUpdateTranscribeAiRoute({ dryRun: true });
    expect(plan).toMatchObject({
      routeKey: "update.transcribe",
      modelKey: "gpt-4o-transcribe",
      promptVersion: "update-transcribe.v1",
      outputSchemaVersion: "update-transcribe-output.v1",
    });
    expect(plan.promptHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(plan.outputSchemaHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.stringify(plan)).not.toMatch(/credential|api[_-]?key|secret/iu);
  });
});
