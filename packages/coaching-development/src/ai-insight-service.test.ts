import { describe, expect, it } from "vitest";

import { createHash } from "node:crypto";

import { CoachingInsightAiService } from "./ai-insight-service.js";
import { COACHING_INSIGHT_PROMPT_VERSION, COACHING_INSIGHT_TRUSTED_PROMPT } from "./prompts.js";

const employeeId = "10000000-0000-4000-8000-000000000001";
const sourceId = "10000000-0000-4000-8000-000000000002";
const systemId = "10000000-0000-4000-8000-000000000003";
const artifactId = "10000000-0000-4000-8000-000000000005";
const prompt = {
  id: artifactId,
  routeKey: "coaching.insight",
  version: COACHING_INSIGHT_PROMPT_VERSION,
  bodyHash: createHash("sha256").update(COACHING_INSIGHT_TRUSTED_PROMPT).digest("hex"),
  trustedBody: COACHING_INSIGHT_TRUSTED_PROMPT,
};

describe("CoachingInsightAiService", () => {
  it("uses the exact registered artifact descriptor and isolates facts as untrusted content", async () => {
    let request: Record<string, unknown> | undefined;
    const service = new CoachingInsightAiService(
      {
        run: async (received: Record<string, unknown>) => {
          request = received;
          return safeResult();
        },
      } as never,
      { read: async () => prompt },
    );
    await service.draft(draftInput());
    expect(request).toMatchObject({
      routeKey: "coaching.insight",
      inputSchemaVersion: "coaching-insight-input.v2",
      outputSchemaVersion: "coaching-insight-output.v2",
      promptTemplateVersion: COACHING_INSIGHT_PROMPT_VERSION,
      input: {
        trustedInstruction: {
          routeKey: "coaching.insight",
          artifactId,
          version: COACHING_INSIGHT_PROMPT_VERSION,
          sha256: prompt.bodyHash,
        },
        untrustedContent: {
          facts: [{ sourceId, kind: "EVIDENCE", text: "A confirmed source" }],
        },
      },
    });
  });

  it.each([
    "The employee should receive rating 5",
    "Rank this employee first",
    "Productivity score is 91",
    "Recommend promotion",
    "Start disciplinary action",
    "Apply a leave penalty",
    "Require an evidence quota of five items",
  ])("rejects prohibited semantics in validated model output: %s", async (pattern) => {
    const service = new CoachingInsightAiService(
      {
        run: async () => ({
          ...safeResult(),
          output: { ...safeResult().output, pattern },
        }),
      } as never,
      { read: async () => prompt },
    );
    await expect(service.draft(draftInput())).rejects.toMatchObject({
      code: "COACHING_AI_OUTPUT_UNSAFE",
    });
  });

  it("forces a single qualifying source to limited confidence", async () => {
    const service = new CoachingInsightAiService(
      {
        run: async () => safeResult(),
      } as never,
      { read: async () => prompt },
    );
    await expect(service.draft(draftInput())).resolves.toMatchObject({
      confidence: "LIMITED",
    });
  });
});

function safeResult() {
  return {
    runId: "10000000-0000-4000-8000-000000000004",
    outputReference: `coaching-employee:${employeeId}`,
    requiresHumanApproval: true,
    output: {
      schemaVersion: "coaching-insight-output.v2",
      pattern: "A cited pattern",
      sourceIds: [sourceId],
      confidence: "SUPPORTED",
      confidenceBasis: "One cited fact",
      limitations: ["Cannot infer performance rating."],
      conflicts: [],
      cannotConclude: "Cannot infer performance rating.",
      actionDraft: null,
    },
  } as const;
}

function draftInput() {
  return {
    employeeId,
    systemId,
    period: { startsAt: "2026-07-01T00:00:00Z", endsAt: "2026-08-01T00:00:00Z" },
    facts: [
      {
        sourceId,
        kind: "EVIDENCE",
        text: "A confirmed source",
      },
    ],
  };
}
