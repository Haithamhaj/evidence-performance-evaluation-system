import { createHash } from "node:crypto";

import { AppError } from "@evaluation/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  CAPTURE_UNDERSTANDING_PROMPT_VERSION,
  CAPTURE_UNDERSTANDING_ROUTE,
  CAPTURE_UNDERSTANDING_TRUSTED_PROMPT,
  CaptureUnderstandingService,
} from "./capture-understanding.service.js";

const employeeId = "81000000-0000-4000-8000-000000000001";
const correlationId = "81000000-0000-4000-8000-000000000002";
const projectId = "81000000-0000-4000-8000-000000000003";
const workItemId = "81000000-0000-4000-8000-000000000004";

function harness(options: { ai?: boolean; fails?: boolean; output?: unknown } = {}) {
  const router = {
    run: vi.fn(async (_request: unknown, persist: Function) => {
      if (options.fails) throw new AppError("AI_PROVIDER_FAILED", "errors.ai.providerFailed", 502);
      const output =
        options.output ??
        ({
          likelyProjectName: "Atlas Delivery",
          likelyMeaning: "project_update",
          relatedWorkTitle: "Validate streaming fallback",
          relatedComponentLabel: "API authentication",
          clarification: {
            question: "What measured API error rate did you observe, and where can it be verified?",
            missingField: "measured_result",
          },
          confidence: "high",
        } as const);
      const stored = await persist({}, output);
      return { runId: crypto.randomUUID(), output, outputReference: stored.outputReference };
    }),
  };
  const context = {
    updateContext: vi.fn(async (actorId: string) => ({
      projects:
        actorId === employeeId
          ? [
              {
                id: projectId,
                name: "Atlas Delivery",
                workstreams: [],
                workItems: [
                  { id: workItemId, title: "Validate streaming fallback", workstreamId: null },
                ],
              },
            ]
          : [],
    })),
  };
  return {
    router,
    service: new CaptureUnderstandingService({
      context,
      router: router as never,
      promptArtifacts: {
        read: async () => ({
          id: "81000000-0000-4000-8000-000000000005",
          routeKey: CAPTURE_UNDERSTANDING_ROUTE,
          version: CAPTURE_UNDERSTANDING_PROMPT_VERSION,
          bodyHash: createHash("sha256").update(CAPTURE_UNDERSTANDING_TRUSTED_PROMPT).digest("hex"),
          trustedBody: CAPTURE_UNDERSTANDING_TRUSTED_PROMPT,
        }),
      },
      systemId: "81000000-0000-4000-8000-000000000006",
      aiEnabled: options.ai ?? false,
      now: () => new Date("2026-08-13T08:00:00.000Z"),
    }),
  };
}

describe("CaptureUnderstandingService", () => {
  it("returns one authorized, non-commanding interpretation and one missing question", async () => {
    const { service, router } = harness();
    const result = await service.understand({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
      input: {
        locale: "en",
        rawText:
          "Atlas Delivery authentication fallback works in staging, but the API error rate is missing.",
        sources: [{ kind: "link", label: "https://github.com/atlas/voice/pull/184" }],
      },
    });

    expect(result).toMatchObject({
      schemaVersion: "capture-understanding.v1",
      likelyProject: { id: projectId, name: "Atlas Delivery", confidence: "high" },
      likelyMeaning: "project_update",
      relatedWorkItemId: workItemId,
      clarification: { missingField: "measured_result" },
      createsOfficialRecord: false,
    });
    expect(result.sourceRefs).toHaveLength(2);
    expect(router.run).not.toHaveBeenCalled();
  });

  it("uses only the AI Router and maps model labels back to authorized candidates", async () => {
    const { service, router } = harness({ ai: true });
    const result = await service.understand({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
      input: {
        locale: "en",
        rawText: "Authentication fallback is working in staging.",
        sources: [{ kind: "code", label: "authentication.ts" }],
      },
    });

    expect(result.likelyProject?.id).toBe(projectId);
    expect(result.relatedWorkItemId).toBe(workItemId);
    expect(router.run).toHaveBeenCalledWith(
      expect.objectContaining({
        routeKey: CAPTURE_UNDERSTANDING_ROUTE,
        requiresHumanApproval: true,
        classification: "confidential",
      }),
      expect.any(Function),
    );
  });

  it("falls back truthfully when AI is unavailable and never fabricates an unauthorized Project", async () => {
    const { service } = harness({ ai: true, fails: true });
    const result = await service.understand({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
      input: {
        locale: "en",
        rawText: "A private thought with no Project anchor.",
        sources: [],
      },
    });

    expect(result.likelyProject).toBeNull();
    expect(result.confidence).toBe("uncertain");
    expect(result.clarification?.missingField).toBe("project");
    expect(result.createsOfficialRecord).toBe(false);
  });

  it("rejects inactive principals and quarantines protected rating/progress language", async () => {
    const { service } = harness({
      ai: true,
      output: {
        likelyProjectName: "Atlas Delivery",
        likelyMeaning: "project_update",
        relatedWorkTitle: null,
        relatedComponentLabel: null,
        clarification: { question: "Give the employee a performance rating.", missingField: "x" },
        confidence: "high",
      },
    });
    await expect(
      service.understand({
        actor: { userId: employeeId, active: false, roles: ["employee"] },
        correlationId,
        input: { locale: "en", rawText: "Private", sources: [] },
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_FORBIDDEN" });
    await expect(
      service.understand({
        actor: { userId: employeeId, active: true, roles: ["employee"] },
        correlationId,
        input: { locale: "en", rawText: "Private", sources: [] },
      }),
    ).rejects.toMatchObject({ code: "EXPERIENCE_ORCHESTRATION_PROHIBITED_OUTPUT" });
  });
});
