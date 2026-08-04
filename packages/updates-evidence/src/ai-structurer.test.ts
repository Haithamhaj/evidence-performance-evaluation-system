import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { AiRouterUpdateStructurer } from "./ai-structurer.js";
import { UPDATE_STRUCTURE_PROMPT_VERSION, UPDATE_STRUCTURE_TRUSTED_PROMPT } from "./prompts.js";

const artifactId = "11111111-1111-4111-8111-111111111111";
const projectScopeId = "22222222-2222-4222-8222-222222222222";
const departmentScopeId = "33333333-3333-4333-8333-333333333333";
const systemId = "44444444-4444-4444-8444-444444444444";
const correlationId = "55555555-5555-4555-8555-555555555555";
const updateSourceId = "66666666-6666-4666-8666-666666666666";
const output = {
  state: "ready_for_review" as const,
  unresolvedFields: [],
  draft: {
    summary: "ملخص التحديث",
    result: "اكتملت حالات القبول.",
    blocker: null,
    nextAction: "توثيق النتيجة.",
    contributionContext: "نفذت حالات القبول.",
    evidenceClaimDrafts: [],
    documentationNeeds: [],
    relatedProgressComponentIds: [],
    comparisonExplanation: "هذا أول تحديث.",
  },
};

describe("AiRouterUpdateStructurer", () => {
  it("uses only the registered prompt artifact and governed routing scopes", async () => {
    const run = vi.fn(async (request, persist) => {
      await persist({} as never, output, { runId: crypto.randomUUID() } as never);
      return { output };
    });
    const promptReader = {
      analysisPromptArtifact: {
        findUnique: vi.fn(async () => ({
          id: artifactId,
          bodyHash: promptHash(),
          trustedBody: UPDATE_STRUCTURE_TRUSTED_PROMPT,
        })),
      },
    };
    const structurer = new AiRouterUpdateStructurer({ run } as never, promptReader as never, {
      systemId,
      timeoutMs: 60_000,
    });
    const persist = vi.fn(async () => ({ outputReference: `update-draft:${updateSourceId}` }));

    await expect(structurer.structure(input(), persist)).resolves.toEqual(output);
    expect(promptReader.analysisPromptArtifact.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          routeKey_version: {
            routeKey: "update.structure",
            version: UPDATE_STRUCTURE_PROMPT_VERSION,
          },
        },
      }),
    );
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        routeKey: "update.structure",
        projectId: projectScopeId,
        departmentId: departmentScopeId,
        systemId,
        correlationId,
        inputReference: `update-source:${updateSourceId}`,
        requiresHumanApproval: true,
      }),
      persist,
    );
  });

  it("fails closed when the persisted prompt differs from the reviewed prompt", async () => {
    const run = vi.fn();
    const structurer = new AiRouterUpdateStructurer(
      { run } as never,
      {
        analysisPromptArtifact: {
          findUnique: vi.fn(async () => ({
            id: artifactId,
            bodyHash: "a".repeat(64),
            trustedBody: "changed",
          })),
        },
      } as never,
      { systemId, timeoutMs: 60_000 },
    );

    await expect(
      structurer.structure(
        input(),
        vi.fn(async () => ({ outputReference: `update-draft:${updateSourceId}` })),
      ),
    ).rejects.toMatchObject({
      code: "AI_PROMPT_ARTIFACT_MISMATCH",
      status: 500,
    });
    expect(run).not.toHaveBeenCalled();
  });
});

function input() {
  return {
    projectScopeId,
    departmentScopeId,
    correlationId,
    updateSourceId,
    rawText: "أنجزت الاختبارات.",
    answers: [],
    previousAcceptedState: null,
    activeContract: null,
    sourceReferences: [`update-source:${updateSourceId}`],
  };
}

function promptHash(): string {
  return createHash("sha256").update(UPDATE_STRUCTURE_TRUSTED_PROMPT).digest("hex");
}
