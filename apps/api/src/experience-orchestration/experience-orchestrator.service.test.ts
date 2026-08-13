import { describe, expect, it, vi } from "vitest";

import {
  EXPERIENCE_PREPARE_PROMPT_VERSION,
  EXPERIENCE_PREPARE_ROUTE,
  EXPERIENCE_PREPARE_TRUSTED_PROMPT,
  ExperienceOrchestratorService,
} from "./experience-orchestrator.service.js";
import { createHash } from "node:crypto";
import { AppError } from "@evaluation/contracts";

const employeeId = "92000000-0000-4000-8000-000000000001";
const correlationId = "92000000-0000-4000-8000-000000000002";
const taskId = "92000000-0000-4000-8000-000000000003";
const projectId = "92000000-0000-4000-8000-000000000004";

const task = {
  id: taskId,
  title: "Confirm the API fallback",
  description: "Sensitive details stay in the owning domain.",
  projectId,
  workstreamId: null,
  assigneeId: employeeId,
  dueAt: "2026-08-12T12:00:00.000Z",
  priority: "high",
  requirements: [],
  acceptanceConditions: [],
  blocker: null,
  nextAction: "Review the focused test result",
  status: "in_progress",
  version: 2,
  createdAt: "2026-08-11T08:00:00.000Z",
  updatedAt: "2026-08-12T07:00:00.000Z",
  checklist: [],
  collaboratorIds: [],
  allowedActions: ["edit", "transition", "add_update"],
};

function harness(
  options: {
    aiEnabled?: boolean;
    routerFails?: boolean;
    wrongUser?: boolean;
    aiOutput?: Record<string, unknown>;
    workspace?: import("@evaluation/contracts").DailyWorkspaceSnapshot;
  } = {},
) {
  const reviewQueue = vi.fn(async ({ actor }: { actor: { userId: string } }) => ({
    items: options.wrongUser || actor.userId !== employeeId ? [] : [],
  }));
  const dailyWorkspace = vi.fn(async (actor: { userId: string }) =>
    options.wrongUser || actor.userId !== employeeId
      ? {
          needsMyAction: [],
          today: [],
          overdue: [],
          reviewQueue: [],
          inbox: [],
          projectPulse: [],
          upcoming: [],
        }
      : (options.workspace ?? {
          needsMyAction: [task],
          today: [],
          overdue: [],
          reviewQueue: [],
          inbox: [],
          projectPulse: [],
          upcoming: [],
        }),
  );
  const rows = new Map<string, import("@evaluation/contracts").PreparedExperienceItem>();
  const persistence = {
    find: vi.fn(async (key: string) => rows.get(key) ?? null),
    appendDeterministic: vi.fn(
      async (
        key: string,
        _employeeId: string,
        item: import("@evaluation/contracts").PreparedExperienceItem,
      ) => {
        rows.set(key, item);
        return item;
      },
    ),
    persistAiOutput: vi.fn(async (_transaction: unknown, input: { outputReference: string }) => {
      return { outputReference: input.outputReference };
    }),
  };
  const router = {
    run: vi.fn(async (request: { sourceReferences: readonly string[] }, persist: Function) => {
      if (options.routerFails) {
        throw new AppError("AI_PROVIDER_FAILED", "errors.ai.providerFailed", 502);
      }
      const output = options.aiOutput ?? {
        kind: "next_action",
        why: "This task is already authorized and needs attention today.",
        consequence: "Review it before making any owning-domain change.",
        editableDraft: {
          title: "Review the API fallback",
          body: "Open the task and verify the focused result.",
        },
      };
      const stored = await persist({}, output);
      return {
        runId: "92000000-0000-4000-8000-000000000009",
        output,
        outputReference: stored.outputReference,
        requiresHumanApproval: true,
      };
    }),
  };
  return {
    reviewQueue,
    dailyWorkspace,
    persistence,
    router,
    service: new ExperienceOrchestratorService({
      contextReview: { reviewQueue },
      dailyWork: { dailyWorkspace } as never,
      persistence: persistence as never,
      router: router as never,
      promptArtifacts: {
        read: async () => ({
          id: "92000000-0000-4000-8000-000000000011",
          routeKey: EXPERIENCE_PREPARE_ROUTE,
          version: EXPERIENCE_PREPARE_PROMPT_VERSION,
          bodyHash: createHash("sha256").update(EXPERIENCE_PREPARE_TRUSTED_PROMPT).digest("hex"),
          trustedBody: EXPERIENCE_PREPARE_TRUSTED_PROMPT,
        }),
      },
      systemId: "92000000-0000-4000-8000-000000000010",
      aiEnabled: options.aiEnabled ?? false,
      now: () => new Date("2026-08-12T07:05:00.000Z"),
    }),
  };
}

describe("ExperienceOrchestratorService", () => {
  it("prepares exactly one source-backed deterministic item without pretending AI ran", async () => {
    const { service, router } = harness();
    const result = await service.compose({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      state: "prepared",
      sourceReferences: [`work-item:${taskId}`],
      why: expect.stringContaining("authorized"),
      consequence: expect.any(String),
      assistance: { mode: "deterministic", routeTrace: null },
    });
    expect(JSON.stringify(result)).not.toMatch(/rating|readiness|productivity|progress/iu);
    expect(router.run).not.toHaveBeenCalled();
  });

  it.each([
    {
      group: "overdue" as const,
      item: { ...task, dueAt: "2026-08-11T07:00:00.000Z" },
      expectedWhy: "overdue",
      expectedBody: "Review the overdue Task",
    },
    {
      group: "today" as const,
      item: task,
      expectedWhy: "due today",
      expectedBody: "Review today's Task",
    },
    {
      group: "needsMyAction" as const,
      item: { ...task, status: "ready" as const },
      expectedWhy: "ready for action",
      expectedBody: "Start the ready Task",
    },
  ])(
    "explains the authoritative $group trigger instead of using a generic prompt",
    async (fixture) => {
      const workspace = {
        needsMyAction: [],
        today: [],
        overdue: [],
        reviewQueue: [],
        inbox: [],
        projectPulse: [],
        upcoming: [],
        [fixture.group]: [fixture.item],
      };
      const { service } = harness({ workspace });

      const result = await service.compose({
        actor: { userId: employeeId, active: true, roles: ["employee"] },
        correlationId,
      });

      expect(result.items[0]?.why.toLowerCase()).toContain(fixture.expectedWhy);
      expect(result.items[0]?.editableDraft.body).toContain(fixture.expectedBody);
    },
  );

  it("uses the governed AI Router and returns its trace while keeping one item", async () => {
    const { service, router } = harness({ aiEnabled: true });
    const result = await service.compose({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.assistance).toEqual({
      mode: "ai_assisted",
      label: "Prepared with governed AI assistance for your review.",
      routeTrace: {
        aiRunId: "92000000-0000-4000-8000-000000000009",
        routeKey: "experience.prepare-next.v1",
        outputReference: expect.stringMatching(/^experience-prepared:/u),
      },
    });
    expect(router.run).toHaveBeenCalledWith(
      expect.objectContaining({
        routeKey: "experience.prepare-next.v1",
        requiresHumanApproval: true,
        sourceReferences: [`work-item:${taskId}`],
      }),
      expect.any(Function),
    );
  });

  it.each([
    ["why", "Performance rating: 5."],
    ["consequence", "Rank the employee first."],
    ["title", "Employee productivity score"],
    ["body", "Documentation readiness is 90 percent."],
    ["why", "Project progress is 100%."],
    ["consequence", "Use the commit count to score employee performance."],
    ["why", "تقييم الأداء: ٥."],
    ["consequence", "ترتيب الموظف الأول."],
    ["title", "ملخص إنتاجية الموظف"],
    ["body", "جاهزية التوثيق مكتملة."],
    ["why", "تقدم المشروع مكتمل."],
    ["consequence", "استخدم عدد المهام لتقييم أداء الموظف."],
  ] as const)("rejects prohibited %s semantics before persistence: %s", async (field, text) => {
    const aiOutput = {
      kind: "next_action",
      why: "Review the authorized source.",
      consequence: "No owning-domain change occurs before review.",
      editableDraft: { title: "Review", body: "Open the authorized item." },
    };
    if (field === "why" || field === "consequence") aiOutput[field] = text;
    else aiOutput.editableDraft[field] = text;
    const { service, persistence } = harness({
      aiEnabled: true,
      aiOutput,
    });
    await expect(
      service.compose({
        actor: { userId: employeeId, active: true, roles: ["employee"] },
        correlationId,
      }),
    ).rejects.toThrow("EXPERIENCE_ORCHESTRATION_PROHIBITED_OUTPUT");
    expect(persistence.persistAiOutput).not.toHaveBeenCalled();
  });

  it("allows a neutral source-backed progress-update phrase without treating it as a score", async () => {
    const { service, persistence } = harness({
      aiEnabled: true,
      aiOutput: {
        kind: "next_action",
        why: "A recent project progress update is available in the authorized source.",
        consequence: "Review the source before deciding the next action.",
        editableDraft: {
          title: "Review the project update",
          body: "Compare the source notes with the current task context.",
        },
      },
    });

    await expect(
      service.compose({
        actor: { userId: employeeId, active: true, roles: ["employee"] },
        correlationId,
      }),
    ).resolves.toMatchObject({ state: "prepared" });
    expect(persistence.persistAiOutput).toHaveBeenCalledOnce();
  });

  it.each(["Improve developer productivity tooling", "Fix commit count logging"])(
    "allows a neutral work phrase without treating it as employee scoring: %s",
    async (title) => {
      const { service, persistence } = harness({
        aiEnabled: true,
        aiOutput: {
          kind: "next_action",
          why: "This authorized task needs review.",
          consequence: "Review the source before deciding the next action.",
          editableDraft: { title, body: "Open the source-backed item." },
        },
      });

      await expect(
        service.compose({
          actor: { userId: employeeId, active: true, roles: ["employee"] },
          correlationId,
        }),
      ).resolves.toMatchObject({ state: "prepared" });
      expect(persistence.persistAiOutput).toHaveBeenCalledOnce();
    },
  );

  it("falls back truthfully when the model is unavailable", async () => {
    const { service } = harness({ aiEnabled: true, routerFails: true });
    const result = await service.compose({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
    });
    expect(result.items[0]?.assistance).toEqual({
      mode: "deterministic",
      label: "AI assistance is unavailable; selected from your authorized Today data.",
      routeTrace: null,
    });
  });

  it("does not disguise an unexpected persistence failure as model unavailability", async () => {
    const { service, persistence } = harness({ aiEnabled: true });
    persistence.persistAiOutput.mockRejectedValueOnce(new Error("append failed"));
    await expect(
      service.compose({
        actor: { userId: employeeId, active: true, roles: ["employee"] },
        correlationId,
      }),
    ).rejects.toThrow("append failed");
  });

  it("cannot recover another user's item when authorized readers return no source", async () => {
    const { service, reviewQueue, dailyWorkspace } = harness({ wrongUser: true });
    const other = "92000000-0000-4000-8000-000000000099";
    await expect(
      service.compose({
        actor: { userId: other, active: true, roles: ["employee"] },
        correlationId,
      }),
    ).resolves.toEqual({ state: "idle", items: [] });
    expect(reviewQueue).toHaveBeenCalledWith({ actor: { userId: other, active: true } });
    expect(dailyWorkspace).toHaveBeenCalledWith({
      userId: other,
      active: true,
      roles: ["employee"],
    });
  });

  it("marks an old authorized source stale without inventing a new action", async () => {
    const { service } = harness();
    const result = await service.compose({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
      staleAfterMs: 60_000,
    });
    expect(result).toMatchObject({
      state: "stale",
      items: [{ state: "stale", freshness: { status: "stale" } }],
    });
  });

  it("recomputes staleness for a cached item without mutating append-only persistence", async () => {
    const { service, persistence } = harness();
    const first = await service.compose({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
      staleAfterMs: 60 * 60 * 1_000,
    });
    const later = new ExperienceOrchestratorService({
      contextReview: { reviewQueue: async () => ({ items: [] }) },
      dailyWork: {
        dailyWorkspace: async () => ({
          needsMyAction: [task],
          today: [],
          overdue: [],
          reviewQueue: [],
          inbox: [],
          projectPulse: [],
          upcoming: [],
        }),
      } as never,
      persistence: persistence as never,
      router: { run: vi.fn() } as never,
      systemId: "92000000-0000-4000-8000-000000000010",
      aiEnabled: false,
      now: () => new Date("2026-08-12T09:00:00.000Z"),
    });
    const cached = await later.compose({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
      staleAfterMs: 60 * 60 * 1_000,
    });
    expect(first.state).toBe("prepared");
    expect(cached).toMatchObject({
      state: "stale",
      items: [{ state: "stale", freshness: { status: "stale" } }],
    });
    expect(persistence.appendDeterministic).toHaveBeenCalledOnce();
  });
});
