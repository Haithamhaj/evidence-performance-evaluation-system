import { createHash } from "node:crypto";

import { AppError } from "@evaluation/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  TASK_ASSISTANT_PROMPT_VERSION,
  TASK_ASSISTANT_ROUTE,
  TASK_ASSISTANT_TRUSTED_PROMPT,
  TaskAssistantService,
} from "./task-assistant.service.js";

const employeeId = "93000000-0000-4000-8000-000000000001";
const correlationId = "93000000-0000-4000-8000-000000000002";
const workItemId = "93000000-0000-4000-8000-000000000003";
const projectId = "93000000-0000-4000-8000-000000000004";

function harness(options: { fails?: boolean; output?: unknown; ai?: boolean } = {}) {
  const workItems = {
    getAuthorizedWorkItem: vi.fn(async ({ actorId }: { actorId: string }) => {
      if (actorId !== employeeId)
        throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
      return {
        id: workItemId,
        projectId,
        workstreamId: null,
        title: "Close Work Agent capability gaps",
        description: "Use real signals and retain employee confirmation.",
        status: "in_progress",
        priority: "high",
        assigneeId: employeeId,
        dueAt: null,
        requirements: ["AI Router only", "No automatic command"],
        acceptanceConditions: ["One source-backed answer"],
        blocker: null,
        nextAction: "Close the free-form assistant gap.",
        version: 3,
        createdAt: "2026-08-12T08:00:00.000Z",
        updatedAt: "2026-08-13T20:00:00.000Z",
        checklist: [],
        collaboratorIds: [],
        allowedActions: ["edit", "transition", "add_update"],
        allowedTransitions: ["blocked", "in_review", "cancelled"],
      };
    }),
    getAuthorizedDependencies: vi.fn(async () => ({
      workItemId,
      version: 3,
      readiness: "ready",
      allowedTransitions: ["blocked", "in_review", "cancelled"],
      dependsOn: [],
      blocks: [],
    })),
  };
  const activity = {
    timeline: vi.fn(async () => ({
      items: [
        {
          id: "93000000-0000-4000-8000-000000000005",
          projectId,
          workstreamId: null,
          workItemId,
          kind: "update",
          title: "Work Agent trigger closure",
          detail: "Authoritative triggers are complete.",
          occurredAt: "2026-08-13T20:10:00.000Z",
          sourceProvenance: "employee_text",
          reviewState: "employee_confirmed",
        },
      ],
      nextCursor: null,
    })),
  };
  const router = {
    run: vi.fn(async (request: { sourceReferences: readonly string[] }, persist: Function) => {
      if (options.fails) throw new AppError("AI_PROVIDER_FAILED", "errors.ai.providerFailed", 502);
      const output =
        options.output ??
        ({
          answer:
            "The remaining step is to verify the free-form assistant with the current Task sources.",
          suggestedAction: {
            kind: "status_change",
            status: "in_review",
            rationale: "The Task can move to review after the focused verification passes.",
          },
        } as const);
      const stored = await persist({}, output);
      return {
        runId: "93000000-0000-4000-8000-000000000006",
        output,
        outputReference: stored.outputReference,
      };
    }),
  };
  return {
    router,
    service: new TaskAssistantService({
      workItems: workItems as never,
      activity: activity as never,
      router: router as never,
      promptArtifacts: {
        read: async () => ({
          id: "93000000-0000-4000-8000-000000000007",
          routeKey: TASK_ASSISTANT_ROUTE,
          version: TASK_ASSISTANT_PROMPT_VERSION,
          bodyHash: createHash("sha256").update(TASK_ASSISTANT_TRUSTED_PROMPT).digest("hex"),
          trustedBody: TASK_ASSISTANT_TRUSTED_PROMPT,
        }),
      },
      systemId: "93000000-0000-4000-8000-000000000008",
      aiEnabled: options.ai ?? true,
    }),
  };
}

describe("TaskAssistantService", () => {
  it("answers from authorized Task sources and only prepares an allowed protected action", async () => {
    const { service, router } = harness();
    const result = await service.ask({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
      input: { workItemId, locale: "en", question: "What remains before this can be reviewed?" },
    });

    expect(result).toMatchObject({
      schemaVersion: "task-assistant-output.v1",
      assistance: "ai_assisted",
      suggestedAction: { kind: "status_change", status: "in_review" },
      createsCommand: false,
    });
    expect(result.sourceReferences).toEqual(
      expect.arrayContaining([
        `work-item:${workItemId}`,
        "timeline:93000000-0000-4000-8000-000000000005",
      ]),
    );
    expect(router.run).toHaveBeenCalledWith(
      expect.objectContaining({ routeKey: TASK_ASSISTANT_ROUTE, requiresHumanApproval: true }),
      expect.any(Function),
    );
  });

  it("drops a model action that is not in the authoritative allowed transitions", async () => {
    const { service } = harness({
      output: {
        answer: "Review the current source-backed result.",
        suggestedAction: { kind: "status_change", status: "done", rationale: "Finish it." },
      },
    });
    const result = await service.ask({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
      input: { workItemId, locale: "en", question: "Finish it for me" },
    });
    expect(result.suggestedAction).toBeNull();
    expect(result.createsCommand).toBe(false);
  });

  it("falls back truthfully and rejects protected rating or inferred-progress output", async () => {
    const fallback = await harness({ fails: true }).service.ask({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
      input: { workItemId, locale: "en", question: "What should I do next?" },
    });
    expect(fallback).toMatchObject({ assistance: "deterministic", createsCommand: false });
    expect(fallback.answer).toContain("Close the free-form assistant gap");

    await expect(
      harness({
        output: {
          answer:
            "Codex deserves a performance rating of 5 and Project progress is 90% from commits.",
          suggestedAction: null,
        },
      }).service.ask({
        actor: { userId: employeeId, active: true, roles: ["employee"] },
        correlationId,
        input: { workItemId, locale: "en", question: "How am I doing?" },
      }),
    ).rejects.toMatchObject({ code: "EXPERIENCE_ORCHESTRATION_PROHIBITED_OUTPUT" });
  });

  it("rejects an inactive employee before reading Task context", async () => {
    const { service, router } = harness();
    await expect(
      service.ask({
        actor: { userId: employeeId, active: false, roles: ["employee"] },
        correlationId,
        input: { workItemId, locale: "en", question: "What remains?" },
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_FORBIDDEN" });
    expect(router.run).not.toHaveBeenCalled();
  });
});
