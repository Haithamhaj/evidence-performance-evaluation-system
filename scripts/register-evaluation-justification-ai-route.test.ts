import { describe, expect, it } from "vitest";

import { registerEvaluationJustificationAiRoute } from "./register-evaluation-justification-ai-route.js";

describe("Evaluation justification AI route registration", () => {
  it("plans the governed Terra wording route without exposing credentials", async () => {
    const plan = await registerEvaluationJustificationAiRoute({ dryRun: true });

    expect(plan).toMatchObject({
      routeKey: "evaluation.justification",
      modelKey: "gpt-5.6-terra",
      promptVersion: "evaluation-justification.v1",
      outputSchemaVersion: "evaluation-justification.v1",
    });
    expect(JSON.stringify(plan)).not.toMatch(/credential|api[_-]?key|token/iu);
  });
});
