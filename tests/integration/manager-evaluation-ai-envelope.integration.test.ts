import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { PromptAwareOpenAiCompatibleAdapter } from "../../packages/ai-routing/src/adapters/prompt-aware-openai-compatible.js";
import {
  MANAGER_EVALUATION_SUMMARY_TRUSTED_PROMPT,
  buildManagerEvaluationSummaryRequest,
} from "../../packages/manager-evaluation/src/index.js";

const routeKey = "manager-evaluation.summary";
const version = "manager-evaluation-summary.v1";
const artifactId = "00000000-0000-4000-8000-000000006101";
const cycleId = "00000000-0000-4000-8000-000000006102";
const responseIds = [
  "00000000-0000-4000-8000-000000006103",
  "00000000-0000-4000-8000-000000006104",
] as const;
const criterionId = "00000000-0000-4000-8000-000000006105";

describe("manager evaluation prompt-aware runtime envelope", () => {
  it("loads the registered prompt artifact and keeps identified originals in the user message", async () => {
    const sha256 = createHash("sha256")
      .update(MANAGER_EVALUATION_SUMMARY_TRUSTED_PROMPT)
      .digest("hex");
    const database = {
      analysisPromptArtifact: {
        findUnique: vi.fn(async () => ({
          id: artifactId,
          routeKey,
          version,
          bodyHash: sha256,
          trustedBody: MANAGER_EVALUATION_SUMMARY_TRUSTED_PROMPT,
        })),
      },
    };
    const fetchImplementation = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    schemaVersion: version,
                    themes: [],
                    limitations: ["Original identified responses remain authoritative."],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    const adapter = new PromptAwareOpenAiCompatibleAdapter({
      database: database as never,
      providerKey: "openai",
      adapterKey: "openai-compatible",
      locality: "external",
      baseUrl: "https://api.openai.com/v1",
      credentialProvider: async () => "test-only-secret",
      fetchImplementation,
    });
    const request = buildManagerEvaluationSummaryRequest({
      prompt: { artifactId, sha256 },
      cycleId,
      period: { startsAt: "2026-07-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z" },
      responses: responseIds.map((responseId) => ({
        responseId,
        submittedAt: "2026-08-01T00:00:00Z",
        responses: [{ criterionId, rating: 3, comment: "Keep weekly priorities visible." }],
      })),
    });

    await expect(
      adapter.generate(
        { routeKey, modelKey: "gpt-5.5-2026-04-23", input: request.input },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ output: { schemaVersion: version } });

    expect(database.analysisPromptArtifact.findUnique).toHaveBeenCalledWith({
      where: { id: artifactId },
      select: { id: true, routeKey: true, version: true, bodyHash: true, trustedBody: true },
    });
    const call = fetchImplementation.mock.calls[0] as unknown as [URL, RequestInit];
    const payload = JSON.parse(String(call[1].body));
    expect(payload.messages[0]).toEqual({
      role: "system",
      content: MANAGER_EVALUATION_SUMMARY_TRUSTED_PROMPT,
    });
    expect(payload.messages[1].role).toBe("user");
    expect(payload.messages[1].content).toContain("Keep weekly priorities visible.");
    expect(JSON.stringify(request.input.trustedInstruction)).not.toContain(
      MANAGER_EVALUATION_SUMMARY_TRUSTED_PROMPT,
    );
  });
});
