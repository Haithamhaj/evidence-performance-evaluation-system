import { AppError } from "@evaluation/contracts";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  AUTH_DATABASE,
  AUTH_TOKEN_VALIDATOR,
  AUTH_USER_SYNCHRONIZER,
  AUTH_VALIDATION_CONFIG,
  AuthGuard,
} from "../auth/auth.guard.js";
import { AppErrorFilter } from "../platform/error.filter.js";
import {
  CONTEXT_INTELLIGENCE_WORKFLOW,
  ContextAnalysisController,
} from "./context-analysis.controller.js";
import {
  CONTEXT_INTELLIGENCE_POLICY_DATABASE,
  ContextIntelligencePolicyGuard,
} from "./context-intelligence-policy.guard.js";
import { TaskDraftsController } from "./task-drafts.controller.js";
import { ContextIntelligenceApplicationService } from "./context-intelligence.module.js";

const ownerId = crypto.randomUUID();
const otherEmployeeId = crypto.randomUUID();
const managerId = crypto.randomUUID();
const systemAdministratorId = crypto.randomUUID();
const inactiveEmployeeId = crypto.randomUUID();
const sourceItemId = crypto.randomUUID();
const suggestionId = crypto.randomUUID();
const draftId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const workItemId = crypto.randomUUID();

type Actor = Readonly<{ userId: string; active: boolean }>;

class ProtectedWorkflowFixture {
  projectAuthorized = true;
  sourceAccessible = true;
  latestDraftRevision = 1;
  officialTask: Record<string, unknown> | null = null;
  privateQueue = [
    {
      kind: "PROJECT_SUGGESTION",
      id: suggestionId,
      sourceItemId,
      explanation: "Private source-backed explanation",
      projectId,
      revision: 1,
    },
  ];

  analyze(input: { actor: Actor; sourceItemId: string }) {
    this.requireOwnedSource(input.actor, input.sourceItemId);
    return {
      analysis: { id: crypto.randomUUID(), sourceItemId, reviewStatus: "PENDING" },
      suggestion: { id: suggestionId, projectId, reviewStatus: "PENDING", revision: 1 },
    };
  }

  reviewQueue(input: { actor: Actor }) {
    this.requireActive(input.actor);
    return {
      items: input.actor.userId === ownerId && this.sourceAccessible ? this.privateQueue : [],
    };
  }

  confirmProjectSuggestion(input: {
    actor: Actor;
    suggestionId: string;
    expectedRevision: number;
  }) {
    this.requireOwner(input.actor, input.suggestionId, suggestionId);
    this.requireProject();
    if (input.expectedRevision !== 1) this.stale();
    return { id: suggestionId, projectId, reviewStatus: "CONFIRMED", revision: 2 };
  }

  correctProjectSuggestion(input: {
    actor: Actor;
    suggestionId: string;
    expectedRevision: number;
    projectId: string | null;
  }) {
    this.requireOwner(input.actor, input.suggestionId, suggestionId);
    if (input.expectedRevision !== 1) this.stale();
    if (input.projectId !== null) this.requireProject();
    return {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      reviewStatus: input.projectId === null ? "REJECTED" : "CORRECTED",
      revision: 2,
    };
  }

  prepareTaskDraft(input: { actor: Actor; sourceItemId: string }) {
    this.requireOwnedSource(input.actor, input.sourceItemId);
    return {
      id: draftId,
      revision: 1,
      reviewStatus: "PENDING",
      draft: {
        title: "Prepare the decision note",
        description: "A useful editable draft is available now.",
        projectId: null,
        workstreamId: null,
        proposedAssigneeId: null,
        dueAt: null,
        acceptanceConditions: [],
        uncertainties: [
          "Project and responsible assignee need confirmation.",
          "Due date is unknown.",
        ],
        sourceReferences: [`connected-source:${sourceItemId}`],
      },
      clarification: {
        requiredFields: ["projectId", "assigneeId"],
        nextQuestion: { field: "projectId" },
      },
    };
  }

  confirmTaskDraft(input: {
    actor: Actor;
    taskDraftId: string;
    expectedRevision: number;
    draft: { projectId: string; assigneeId: string };
  }) {
    this.requireOwner(input.actor, input.taskDraftId, draftId);
    if (!this.sourceAccessible) this.forbidden();
    if (input.expectedRevision !== this.latestDraftRevision) this.stale();
    this.requireProject();
    if (input.draft.projectId !== projectId || input.draft.assigneeId.length === 0) {
      throw new AppError(
        "CONTEXT_CONFIRMATION_REQUIRED",
        "errors.contextIntelligence.confirmationRequired",
        409,
      );
    }
    this.officialTask ??= {
      id: workItemId,
      projectId,
      assigneeId: input.draft.assigneeId,
      title: "Prepare the decision note",
    };
    return { taskDraftId: draftId, confirmedRevision: 2, workItem: this.officialTask };
  }

  private requireOwnedSource(actor: Actor, requestedSourceId: string): void {
    this.requireActive(actor);
    if (!this.sourceAccessible || actor.userId !== ownerId || requestedSourceId !== sourceItemId) {
      this.forbidden();
    }
  }

  private requireOwner(actor: Actor, requestedId: string, ownedId: string): void {
    this.requireActive(actor);
    if (actor.userId !== ownerId || requestedId !== ownedId) this.forbidden();
  }

  private requireActive(actor: Actor): void {
    if (!actor.active) this.forbidden();
  }

  private requireProject(): void {
    if (!this.projectAuthorized) this.forbidden();
  }

  private stale(): never {
    throw new AppError(
      "CONTEXT_DRAFT_VERSION_CONFLICT",
      "errors.contextIntelligence.versionConflict",
      409,
    );
  }

  private forbidden(): never {
    throw new AppError(
      "CONTEXT_INTELLIGENCE_FORBIDDEN",
      "errors.contextIntelligence.forbidden",
      403,
    );
  }
}

const workflow = new ProtectedWorkflowFixture();

class TestContextIntelligenceModule {}

Module({
  controllers: [ContextAnalysisController, TaskDraftsController],
  providers: [
    { provide: AUTH_VALIDATION_CONFIG, useValue: {} },
    { provide: AUTH_DATABASE, useValue: {} },
    {
      provide: AUTH_TOKEN_VALIDATOR,
      useValue: async (token: string) => ({
        email: `${token}@example.invalid`,
        issuer: "https://identity.example.invalid",
        oidcSubject: token,
      }),
    },
    {
      provide: AUTH_USER_SYNCHRONIZER,
      useValue: async (
        _database: unknown,
        external: import("@evaluation/auth").ValidatedOidcPrincipal,
      ) => ({
        userId: external.oidcSubject,
        active: external.oidcSubject !== inactiveEmployeeId,
        email: external.email,
        oidcSubject: external.oidcSubject,
        roles:
          external.oidcSubject === managerId
            ? ["manager"]
            : external.oidcSubject === systemAdministratorId
              ? ["system_administrator"]
              : ["employee"],
      }),
    },
    AuthGuard,
    {
      provide: CONTEXT_INTELLIGENCE_POLICY_DATABASE,
      useValue: {
        roleAssignment: {
          findFirst: async (input: { where: { userId: string } }) =>
            ([ownerId, otherEmployeeId, inactiveEmployeeId] as string[]).includes(
              input.where.userId,
            )
              ? { id: crypto.randomUUID() }
              : null,
        },
      },
    },
    ContextIntelligencePolicyGuard,
    { provide: CONTEXT_INTELLIGENCE_WORKFLOW, useValue: workflow },
  ],
})(TestContextIntelligenceModule);

let app: import("@nestjs/common").INestApplication | undefined;
let baseUrl = "";

beforeAll(async () => {
  app = await NestFactory.create(TestContextIntelligenceModule, {
    abortOnError: false,
    logger: false,
  });
  app.useGlobalFilters(new AppErrorFilter());
  app.use(
    (
      request: { headers: Record<string, string | undefined>; correlationId?: string },
      _response: unknown,
      next: () => void,
    ) => {
      request.correlationId = request.headers["x-correlation-id"] ?? crypto.randomUUID();
      next();
    },
  );
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as import("node:net").AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => app?.close());

beforeEach(() => {
  workflow.projectAuthorized = true;
  workflow.sourceAccessible = true;
  workflow.latestDraftRevision = 1;
  workflow.officialTask = null;
});

async function apiRequest(method: "GET" | "POST", path: string, token: string, body?: unknown) {
  const correlationId = crypto.randomUUID();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-correlation-id": correlationId,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    response,
    body: (await response.json()) as Record<string, any>,
    correlationId,
  };
}

function confirmedDraft() {
  return {
    expectedRevision: 1,
    reason: "I reviewed and confirmed this Task.",
    draft: {
      title: "Prepare the decision note",
      description: "Record the reviewed decision.",
      projectId,
      workstreamId: null,
      assigneeId: ownerId,
      dueAt: null,
      acceptanceConditions: [],
    },
  };
}

describe("Context Intelligence protected HTTP API", () => {
  it("exposes the exact analysis, review, suggestion, and Task routes", async () => {
    const analyzed = await apiRequest(
      "POST",
      `/api/v1/context/items/${sourceItemId}/analyze`,
      ownerId,
      {},
    );
    const queue = await apiRequest("GET", "/api/v1/context/review-queue", ownerId);
    const confirmedSuggestion = await apiRequest(
      "POST",
      `/api/v1/context/project-suggestions/${suggestionId}/confirm`,
      ownerId,
      { expectedRevision: 1, reason: "I reviewed this Project link." },
    );
    const correctedSuggestion = await apiRequest(
      "POST",
      `/api/v1/context/project-suggestions/${suggestionId}/correct`,
      ownerId,
      { expectedRevision: 1, projectId, reason: "I selected the correct Project." },
    );
    const draft = await apiRequest("POST", "/api/v1/context/task-drafts", ownerId, {
      sourceItemId,
    });
    const task = await apiRequest(
      "POST",
      `/api/v1/context/task-drafts/${draftId}/confirm`,
      ownerId,
      confirmedDraft(),
    );

    expect(analyzed.response.status).toBe(201);
    expect(queue.response.status).toBe(200);
    expect(confirmedSuggestion.response.status).toBe(201);
    expect(correctedSuggestion.response.status).toBe(201);
    expect(draft.response.status).toBe(201);
    expect(task.response.status).toBe(201);
  });

  it("returns owner-only review data and denies manager-only and administrator-only personas", async () => {
    const owner = await apiRequest("GET", "/api/v1/context/review-queue", ownerId);
    const other = await apiRequest("GET", "/api/v1/context/review-queue", otherEmployeeId);
    const manager = await apiRequest("GET", "/api/v1/context/review-queue", managerId);
    const administrator = await apiRequest(
      "GET",
      "/api/v1/context/review-queue",
      systemAdministratorId,
    );

    expect(owner.body).toMatchObject({ items: [{ id: suggestionId }] });
    expect(other.body).toEqual({ items: [] });
    expect(manager.response.status).toBe(403);
    expect(administrator.response.status).toBe(403);
    expect(JSON.stringify(other.body)).not.toContain("Private source-backed explanation");
    expect(JSON.stringify(manager.body)).not.toContain(sourceItemId);
    expect(JSON.stringify(administrator.body)).not.toContain(sourceItemId);
  });

  it("denies Context Intelligence mutations to a manager-only persona", async () => {
    const analyzed = await apiRequest(
      "POST",
      `/api/v1/context/items/${sourceItemId}/analyze`,
      managerId,
      {},
    );
    const confirmed = await apiRequest(
      "POST",
      `/api/v1/context/task-drafts/${draftId}/confirm`,
      managerId,
      confirmedDraft(),
    );

    expect(analyzed.response.status).toBe(403);
    expect(confirmed.response.status).toBe(403);
  });

  it("denies cross-employee, inactive, and inaccessible private source analysis", async () => {
    const other = await apiRequest(
      "POST",
      `/api/v1/context/items/${sourceItemId}/analyze`,
      otherEmployeeId,
      {},
    );
    const inactive = await apiRequest(
      "POST",
      `/api/v1/context/items/${sourceItemId}/analyze`,
      inactiveEmployeeId,
      {},
    );
    workflow.sourceAccessible = false;
    const inaccessible = await apiRequest(
      "POST",
      `/api/v1/context/items/${sourceItemId}/analyze`,
      ownerId,
      {},
    );

    expect(other.response.status).toBe(403);
    expect(inactive.response.status).toBe(403);
    expect(inaccessible.response.status).toBe(403);
  });

  it("returns an editable useful draft while clarifying only confirmation-required fields", async () => {
    const response = await apiRequest("POST", "/api/v1/context/task-drafts", ownerId, {
      sourceItemId,
    });

    expect(response.body).toMatchObject({
      draft: {
        title: "Prepare the decision note",
        description: "A useful editable draft is available now.",
        dueAt: null,
        uncertainties: expect.arrayContaining(["Due date is unknown."]),
      },
      clarification: {
        requiredFields: ["projectId", "assigneeId"],
        nextQuestion: { field: "projectId" },
      },
    });
    expect(response.body.clarification.requiredFields).not.toContain("dueAt");
    expect(response.body.clarification.requiredFields).not.toContain("acceptanceConditions");
  });

  it("rejects a stale draft revision and revoked Project membership", async () => {
    workflow.latestDraftRevision = 2;
    const stale = await apiRequest(
      "POST",
      `/api/v1/context/task-drafts/${draftId}/confirm`,
      ownerId,
      confirmedDraft(),
    );
    workflow.latestDraftRevision = 1;
    workflow.projectAuthorized = false;
    const revoked = await apiRequest(
      "POST",
      `/api/v1/context/task-drafts/${draftId}/confirm`,
      ownerId,
      confirmedDraft(),
    );

    expect(stale.response.status).toBe(409);
    expect(stale.body).toMatchObject({ code: "CONTEXT_DRAFT_VERSION_CONFLICT" });
    expect(revoked.response.status).toBe(403);
  });

  it("makes human Task confirmation idempotent across a lost response", async () => {
    const first = await apiRequest(
      "POST",
      `/api/v1/context/task-drafts/${draftId}/confirm`,
      ownerId,
      confirmedDraft(),
    );
    const retried = await apiRequest(
      "POST",
      `/api/v1/context/task-drafts/${draftId}/confirm`,
      ownerId,
      confirmedDraft(),
    );

    expect(first.body).toEqual(retried.body);
    expect(first.body).toMatchObject({ workItem: { id: workItemId, assigneeId: ownerId } });
  });
});

describe("Context Intelligence Task confirmation transaction", () => {
  it("atomically appends confirmation and calls the public Work Items service once across retries", async () => {
    const fixture = confirmationHarness();

    const first = await fixture.service.confirmTaskDraft(fixture.command);
    const retried = await fixture.service.confirmTaskDraft(fixture.command);

    expect(first).toEqual(retried);
    expect(first).toMatchObject({ workItem: { projectId, assigneeId: ownerId } });
    expect(fixture.state.workItems).toHaveLength(1);
    expect(fixture.state.taskDrafts).toHaveLength(2);
    expect(fixture.state.assignments).toHaveLength(1);
    expect(fixture.state.taskDrafts[1]).toMatchObject({
      reviewStatus: "CONFIRMED",
      revisionOrigin: "EMPLOYEE",
      supersedesTaskDraftId: draftId,
    });
  });

  it("rolls back the official Task and confirmation revision when the protected audit fails", async () => {
    const fixture = confirmationHarness({ failAuditAt: 2 });

    await expect(fixture.service.confirmTaskDraft(fixture.command)).rejects.toThrow(
      "simulated protected audit failure",
    );
    expect(fixture.state.workItems).toHaveLength(0);
    expect(fixture.state.taskDrafts).toHaveLength(1);
    expect(fixture.state.assignments).toHaveLength(0);
  });

  it("revalidates source access inside the write transaction after the precheck", async () => {
    const fixture = confirmationHarness({ revokeSourceAfterPrecheck: true });

    await expect(fixture.service.confirmTaskDraft(fixture.command)).rejects.toMatchObject({
      code: "CONNECTED_CONTEXT_FORBIDDEN",
    });
    expect(fixture.state.workItems).toHaveLength(0);
    expect(fixture.state.taskDrafts).toHaveLength(1);
  });

  it("treats a changed protected reason as an idempotency conflict after response loss", async () => {
    const fixture = confirmationHarness();
    await fixture.service.confirmTaskDraft(fixture.command);

    await expect(
      fixture.service.confirmTaskDraft({
        ...fixture.command,
        reason: "A different private confirmation reason",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(fixture.state.workItems).toHaveLength(1);
    expect(fixture.state.taskDrafts).toHaveLength(2);
  });

  it("stores the employee reason only in the protected Task Draft revision", async () => {
    const fixture = confirmationHarness();
    await fixture.service.confirmTaskDraft(fixture.command);

    expect(fixture.state.taskDrafts[1]?.correctionReasonCiphertext).toBe(fixture.command.reason);
    expect(JSON.stringify(fixture.state.audits)).not.toContain(fixture.command.reason);
    expect(JSON.stringify(fixture.state.assignments)).not.toContain(fixture.command.reason);
  });
});

describe("Context Intelligence review queue transaction", () => {
  it("selects only actionable current leaves before any protected content is opened", async () => {
    const selected: Array<Record<string, unknown>> = [];
    const transaction = {
      projectLinkSuggestion: {
        findMany: async (input: Record<string, unknown>) => {
          selected.push(input);
          return [];
        },
      },
      taskDraft: {
        findMany: async (input: Record<string, unknown>) => {
          selected.push(input);
          return [];
        },
      },
    };
    const database = {
      $transaction: async (operation: (value: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    };
    const service = new ContextIntelligenceApplicationService(
      database as never,
      {} as never,
      {} as never,
      {
        seal: async (value: string) => ({ ciphertext: value, keyVersion: "test-key-v1" }),
        open: async () => {
          throw new Error("No terminal record may be decrypted");
        },
      },
      { router: { run: async () => undefined } as never, systemId: crypto.randomUUID() },
    );

    await expect(
      service.reviewQueue({ actor: { userId: ownerId, active: true } }),
    ).resolves.toEqual({ items: [] });
    expect(selected[0]).toMatchObject({
      where: {
        employeeId: ownerId,
        reviewStatus: "PENDING",
        supersedingSuggestion: null,
      },
    });
    expect(selected[1]).toMatchObject({
      where: {
        employeeId: ownerId,
        reviewStatus: { in: ["PENDING", "CORRECTED"] },
        supersedingTaskDraft: null,
      },
    });
  });

  it("does not decrypt or return a row whose source access is revoked after selection", async () => {
    let protectedOpenCount = 0;
    const transaction = {
      projectLinkSuggestion: {
        findMany: async () => [
          {
            id: suggestionId,
            sourceItemId,
            employeeId: ownerId,
          },
        ],
      },
      taskDraft: { findMany: async () => [] },
    };
    const database = {
      $transaction: async (operation: (value: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    };
    const context = {
      assertAccessibleInTransaction: async () => {
        throw new AppError("CONNECTED_CONTEXT_FORBIDDEN", "errors.connectedContext.forbidden", 403);
      },
    };
    const protector = {
      seal: async (value: string) => ({ ciphertext: value, keyVersion: "test-key-v1" }),
      open: async () => {
        protectedOpenCount += 1;
        return "private-derived-content";
      },
    };
    const service = new ContextIntelligenceApplicationService(
      database as never,
      context as never,
      {} as never,
      protector,
      { router: { run: async () => undefined } as never, systemId: crypto.randomUUID() },
    );

    await expect(
      service.reviewQueue({ actor: { userId: ownerId, active: true } }),
    ).resolves.toEqual({ items: [] });
    expect(protectedOpenCount).toBe(0);
  });
});

describe("Context Intelligence Project confirmation transaction", () => {
  it("reauthorizes the source before decrypting or acknowledging an idempotent replay", async () => {
    const reason = "I reviewed this Project link.";
    const aiRunTrace = {
      id: crypto.randomUUID(),
      routeKey: "context.project-match.v1",
      routeConfigId: crypto.randomUUID(),
      routeConfigVersion: 1,
    };
    const original = {
      id: suggestionId,
      analysisId: crypto.randomUUID(),
      sourceItemId,
      employeeId: ownerId,
      projectId,
      decision: "AUTO_LINK" as const,
      explanationCiphertext: "private explanation",
      explanationKeyVersion: "test-key-v1",
      anchors: [
        {
          kind: "EXPLICIT_USER_MAPPING",
          reference: `source-project-link:${sourceItemId}`,
          conflicts: false,
        },
      ],
      revision: 1,
      schemaVersion: "context-project-match-output.v1",
      promptVersion: "context-project-match-prompt.v1",
      aiRunTraceId: aiRunTrace.id,
      sourceReferences: [`connected-source:${sourceItemId}`],
      reviewStatus: "PENDING" as const,
      revisionOrigin: "AI" as const,
      correctionReasonCiphertext: null,
      correctionReasonKeyVersion: null,
      supersedesSuggestionId: null,
      createdById: ownerId,
      createdAt: new Date("2026-08-02T12:00:00.000Z"),
      aiRunTrace,
    };
    const confirmed = {
      ...original,
      id: crypto.randomUUID(),
      revision: 2,
      reviewStatus: "CONFIRMED" as const,
      revisionOrigin: "EMPLOYEE" as const,
      correctionReasonCiphertext: reason,
      correctionReasonKeyVersion: "test-key-v1",
      supersedesSuggestionId: original.id,
      createdAt: new Date("2026-08-02T12:01:00.000Z"),
    };
    const stored = { ...original, supersedingSuggestion: confirmed };
    const transaction = {
      $queryRaw: async () => [],
      projectLinkSuggestion: { findUnique: async () => stored },
    };
    const database = {
      projectLinkSuggestion: { findUnique: async () => stored },
      $transaction: async (operation: (value: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    };
    let protectedOpenCount = 0;
    const protector = {
      seal: async (value: string) => ({ ciphertext: value, keyVersion: "test-key-v1" }),
      open: async ({ ciphertext }: { ciphertext: string }) => {
        protectedOpenCount += 1;
        return ciphertext;
      },
    };
    const context = {
      assertAccessibleInTransaction: async () => {
        throw new AppError("CONNECTED_CONTEXT_FORBIDDEN", "errors.connectedContext.forbidden", 403);
      },
    };
    const service = new ContextIntelligenceApplicationService(
      database as never,
      context as never,
      {} as never,
      protector,
      { router: { run: async () => undefined } as never, systemId: crypto.randomUUID() },
    );

    await expect(
      service.confirmProjectSuggestion({
        actor: { userId: ownerId, active: true },
        suggestionId,
        expectedRevision: 1,
        reason,
        correlationId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CONNECTED_CONTEXT_FORBIDDEN" });
    expect(protectedOpenCount).toBe(0);
  });
});

function confirmationHarness(
  options: Readonly<{ failAuditAt?: number; revokeSourceAfterPrecheck?: boolean }> = {},
) {
  const now = new Date("2026-08-02T12:00:00.000Z");
  const aiRunTrace = {
    id: crypto.randomUUID(),
    routeKey: "task.draft.v1",
    routeConfigId: crypto.randomUUID(),
    routeConfigVersion: 1,
  };
  const initialDraft = {
    id: draftId,
    sourceItemId,
    employeeId: ownerId,
    draftCiphertext: JSON.stringify({
      title: "Prepare the decision note",
      description: "A useful employee-reviewable draft.",
      projectId,
      workstreamId: null,
      proposedAssigneeId: ownerId,
      dueAt: null,
      acceptanceConditions: [],
      sourceReferences: [`connected-source:${sourceItemId}`],
      uncertainties: ["Due date is optional and unknown."],
    }),
    draftKeyVersion: "test-key-v1",
    projectId,
    workstreamId: null,
    proposedAssigneeId: ownerId,
    dueAt: null,
    revision: 1,
    schemaVersion: "task-draft-output.v1",
    promptVersion: "task-draft-prompt.v1",
    aiRunTraceId: aiRunTrace.id,
    sourceReferences: [`connected-source:${sourceItemId}`],
    reviewStatus: "PENDING" as const,
    revisionOrigin: "AI" as const,
    correctionReasonCiphertext: null,
    correctionReasonKeyVersion: null,
    supersedesTaskDraftId: null,
    createdById: ownerId,
    createdAt: now,
    aiRunTrace,
  };
  const state = {
    taskDrafts: [initialDraft] as Array<Record<string, any>>,
    workItems: [] as Array<Record<string, any>>,
    assignments: [] as Array<Record<string, any>>,
    audits: [] as Array<Record<string, any>>,
  };
  let auditAttempt = 0;
  let sourceAccessible = true;

  const findTaskDraft = async (input: Record<string, any>) => {
    const row = state.taskDrafts.find(({ id }) => id === input.where.id);
    if (row === undefined) return null;
    if (input.select !== undefined) {
      return { employeeId: row.employeeId, sourceItemId: row.sourceItemId };
    }
    const supersedingTaskDraft = state.taskDrafts.find(
      ({ supersedesTaskDraftId }) => supersedesTaskDraftId === row.id,
    );
    return {
      ...row,
      aiRunTrace,
      ...(input.include?.supersedingTaskDraft === undefined
        ? {}
        : {
            supersedingTaskDraft:
              supersedingTaskDraft === undefined ? null : { ...supersedingTaskDraft, aiRunTrace },
          }),
    };
  };
  const transaction = {
    $queryRaw: async () => [{ id: projectId, departmentId: crypto.randomUUID(), status: "active" }],
    project: {
      findUnique: async () => ({
        id: projectId,
        departmentId: crypto.randomUUID(),
        status: "active",
        members: [{ id: crypto.randomUUID() }],
      }),
    },
    roleAssignment: { findFirst: async () => null },
    workstream: { findUnique: async () => null },
    projectMember: { findFirst: async () => ({ id: crypto.randomUUID() }) },
    workItem: {
      findUnique: async (input: Record<string, any>) =>
        state.workItems.find(({ id }) => id === input.where.id) ?? null,
      create: async (input: Record<string, any>) => {
        const row = {
          ...input.data,
          status: "planned",
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        state.workItems.push(row);
        return row;
      },
    },
    workItemAssignmentHistory: {
      create: async (input: Record<string, any>) => {
        state.assignments.push(input.data);
        return input.data;
      },
    },
    taskDraft: {
      findUnique: findTaskDraft,
      create: async (input: Record<string, any>) => {
        const row = { ...input.data, aiRunTrace };
        state.taskDrafts.push(row);
        return row;
      },
    },
    auditEvent: {
      create: async (input: Record<string, any>) => {
        auditAttempt += 1;
        if (options.failAuditAt === auditAttempt) {
          throw new Error("simulated protected audit failure");
        }
        state.audits.push(input.data);
        return { id: crypto.randomUUID(), createdAt: now };
      },
    },
  };
  const database = {
    taskDraft: { findUnique: findTaskDraft },
    $transaction: async (operation: (value: typeof transaction) => Promise<unknown>) => {
      const snapshot = {
        taskDrafts: state.taskDrafts.length,
        workItems: state.workItems.length,
        assignments: state.assignments.length,
        audits: state.audits.length,
      };
      try {
        return await operation(transaction);
      } catch (error) {
        state.taskDrafts.length = snapshot.taskDrafts;
        state.workItems.length = snapshot.workItems;
        state.assignments.length = snapshot.assignments;
        state.audits.length = snapshot.audits;
        throw error;
      }
    },
  };
  const protector = {
    seal: async (value: string) => ({ ciphertext: value, keyVersion: "test-key-v1" }),
    open: async (input: { ciphertext: string }) => input.ciphertext,
  };
  const context = {
    get: async ({ actor, sourceItemId: requestedId }: { actor: Actor; sourceItemId: string }) => {
      if (!sourceAccessible || actor.userId !== ownerId || requestedId !== sourceItemId) {
        throw new AppError(
          "CONTEXT_INTELLIGENCE_FORBIDDEN",
          "errors.contextIntelligence.forbidden",
          403,
        );
      }
      if (options.revokeSourceAfterPrecheck === true) sourceAccessible = false;
      return {
        id: sourceItemId,
        employeeId: ownerId,
        provider: "GOOGLE_GMAIL" as const,
        providerSourceId: "private-source",
        occurredAt: now.toISOString(),
        title: "Private source",
        summary: "Private summary",
        sourceUrl: null,
        privacy: "PRIVATE" as const,
        excluded: false,
      };
    },
    assertAccessibleInTransaction: async (
      _transaction: unknown,
      { actor, sourceItemId: requestedId }: { actor: Actor; sourceItemId: string },
    ) => {
      if (!sourceAccessible || actor.userId !== ownerId || requestedId !== sourceItemId) {
        throw new AppError("CONNECTED_CONTEXT_FORBIDDEN", "errors.connectedContext.forbidden", 403);
      }
    },
  };
  const service = new ContextIntelligenceApplicationService(
    database as never,
    context as never,
    {} as never,
    protector,
    { router: { run: async () => undefined } as never, systemId: crypto.randomUUID() },
  );
  const command = {
    actor: { userId: ownerId, active: true },
    taskDraftId: draftId,
    expectedRevision: 1,
    reason: "I reviewed and confirmed this Task.",
    draft: confirmedDraft().draft,
    correlationId: crypto.randomUUID(),
  };
  return { service, command, state };
}
