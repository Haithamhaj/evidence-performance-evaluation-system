import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants.js";
import { describe, expect, it, vi } from "vitest";

import { AnalysisCriteriaAuthenticationGuard } from "./analysis-criteria-authentication.guard.js";
import {
  ANALYSIS_CRITERIA_POLICY_ACTION,
  AnalysisCriteriaPolicyGuard,
} from "./analysis-criteria-policy.guard.js";
import { CriteriaController } from "./criteria.controller.js";

const actorId = "00000000-0000-4000-8000-000000000001";
const correlationId = "00000000-0000-4000-8000-000000000002";
const resourceId = "00000000-0000-4000-8000-000000000003";
const documentId = "00000000-0000-4000-8000-000000000007";
const documentVersionId = "00000000-0000-4000-8000-000000000004";
const proposalId = "00000000-0000-4000-8000-000000000005";
const comparisonReviewId = "00000000-0000-4000-8000-000000000006";
const snapshotId = "00000000-0000-4000-8000-000000000030";

function request(roles: readonly import("@evaluation/permissions").Role[] = ["project_owner"]) {
  return {
    principal: {
      userId: actorId,
      oidcSubject: "owner",
      email: "owner@example.invalid",
      roles,
      active: true,
    },
    correlationId,
  } as const;
}

function services() {
  const receipt = {
    requestId: "00000000-0000-4000-8000-000000000020",
    operationId: "00000000-0000-4000-8000-000000000020",
    state: "queued",
    documentId,
    documentVersionIds: [documentVersionId],
  };
  return {
    receipt,
    proposals: {
      requestGeneration: vi.fn(async () => receipt),
      reviewByOwner: vi.fn(async (value: unknown) => value),
    },
    reviews: {
      respond: vi.fn(async (value: unknown) => value),
      resolve: vi.fn(async (value: unknown) => value),
    },
    activation: { activate: vi.fn(async (value: unknown) => value) },
    revisions: { start: vi.fn(async () => receipt) },
    versions: { resolve: vi.fn(async (value: unknown) => value) },
    workspace: { get: vi.fn(async (value: unknown) => value) },
    jobs: { enqueueAfterCommit: vi.fn(async () => "queued-job") },
  };
}

function controller(service = services()) {
  return {
    instance: new CriteriaController(
      service.proposals as never,
      service.reviews as never,
      service.activation as never,
      service.revisions as never,
      service.versions as never,
      service.workspace as never,
      service.jobs as never,
    ),
    service,
  };
}

describe("CriteriaController", () => {
  it("strictly creates route-bound project or workstream proposal requests", async () => {
    const { instance, service } = controller();
    const body = {
      kind: "project",
      resourceId,
      documentVersionId,
      idempotencyKey: "criteria-project-v1",
    } as const;

    await instance.createProposal(request(), body);
    expect(service.proposals.requestGeneration).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      ...body,
    });
    expect(service.jobs.enqueueAfterCommit).toHaveBeenCalledWith(service.receipt);
    await expect(
      instance.createProposal(request(), { ...body, routeKey: "document.analyze" }),
    ).rejects.toMatchObject({
      code: "ANALYSIS_CRITERIA_INPUT_INVALID",
      status: 400,
    });
  });

  it("accepts and forwards exact replacement lineage and owner feedback", async () => {
    const { instance, service } = controller();
    const body = {
      kind: "workstream",
      resourceId,
      documentVersionId,
      idempotencyKey: "criteria-workstream-replacement-v1",
      replacesProposalId: proposalId,
      ownerFeedback: "Revise through a new owner-reviewed proposal.",
    } as const;

    await instance.createProposal(request(["workstream_owner"]), body);

    expect(service.proposals.requestGeneration).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      ...body,
    });
    expect(service.jobs.enqueueAfterCommit).toHaveBeenCalledWith(service.receipt);
  });

  it("keeps owner review and publication as separate strict actions", async () => {
    const { instance, service } = controller();
    const review = {
      action: "request_correction",
      reason: "Clarify the measurable outcome",
      feedback: "Use the approved source definition",
    } as const;

    await instance.reviewByOwner(request(), proposalId, review);
    expect(service.proposals.reviewByOwner).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      proposalId,
      review,
    });
    expect(() =>
      instance.reviewByOwner(request(), proposalId, {
        action: "approve",
        reason: "Publish separately",
      }),
    ).toThrowError(expect.objectContaining({ code: "ANALYSIS_CRITERIA_INPUT_INVALID" }));

    await instance.publish(request(), proposalId, { reason: "Owner review completed" });
    expect(service.proposals.reviewByOwner).toHaveBeenLastCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      proposalId,
      review: { action: "approve", reason: "Owner review completed" },
    });
  });

  it("binds contributor responses to the authenticated actor and rejects identity injection", async () => {
    const { instance, service } = controller();

    await instance.respond(request(["contributor"]), proposalId, { action: "acknowledge" });
    expect(service.reviews.respond).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      proposalId,
      response: { action: "acknowledge" },
    });
    expect(() =>
      instance.respond(request(["contributor"]), proposalId, {
        action: "acknowledge",
        employeeId: "00000000-0000-4000-8000-000000000099",
      }),
    ).toThrowError(expect.objectContaining({ code: "ANALYSIS_CRITERIA_INPUT_INVALID" }));
    expect(service.reviews.respond).toHaveBeenCalledTimes(1);
  });

  it("strictly binds manager resolution, activation, and prospective revision", async () => {
    const { instance, service } = controller();
    await instance.resolveByManager(request(["manager"]), proposalId, {
      decision: "accept_with_objections",
      reason: "Objections remain preserved",
    });
    expect(service.reviews.resolve).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      proposalId,
      resolution: {
        decision: "accept_with_objections",
        reason: "Objections remain preserved",
      },
    });

    const activation = {
      expectedProposalVersion: 2,
      effectiveFrom: "2026-07-18T00:00:00.000Z",
      reason: "Prospective activation",
    };
    await instance.activate(request(), proposalId, activation);
    expect(service.activation.activate).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      proposalId,
      activation,
    });

    const revision = {
      kind: "project",
      resourceId,
      idempotencyKey: "criteria-revision-v1",
      comparisonReviewId,
      reason: "Material change confirmed",
    } as const;
    await instance.revise(request(), revision);
    expect(service.revisions.start).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      kind: "project",
      resourceId,
      idempotencyKey: "criteria-revision-v1",
      revision: {
        comparisonReviewId,
        reason: "Material change confirmed",
      },
    });
    expect(service.jobs.enqueueAfterCommit).toHaveBeenCalledWith(service.receipt);
  });

  it("never enqueues a proposal or revision whose transaction failed", async () => {
    const service = services();
    service.proposals.requestGeneration.mockRejectedValueOnce(
      new Error("proposal transaction rolled back"),
    );
    service.revisions.start.mockRejectedValueOnce(new Error("revision transaction rolled back"));
    const { instance } = controller(service);
    await expect(
      instance.createProposal(request(), {
        kind: "project",
        resourceId,
        documentVersionId,
        idempotencyKey: "proposal-failure",
      }),
    ).rejects.toThrow(/rolled back/u);
    await expect(
      instance.revise(request(), {
        kind: "project",
        resourceId,
        idempotencyKey: "revision-failure",
        comparisonReviewId,
        reason: "Material change confirmed",
      }),
    ).rejects.toThrow(/rolled back/u);
    expect(service.jobs.enqueueAfterCommit).not.toHaveBeenCalled();
  });

  it("resolves active criteria at an explicitly parsed timestamp", async () => {
    const { instance, service } = controller();
    await instance.getActive(request(["employee"]), {
      kind: "workstream",
      resourceId,
      occurredAt: "2026-07-17T12:00:00.000Z",
    });
    expect(service.versions.resolve).toHaveBeenCalledWith({
      kind: "workstream",
      resourceId,
      occurredAt: new Date("2026-07-17T12:00:00.000Z"),
    });
    expect(() =>
      instance.getActive(request(["employee"]), {
        kind: "workstream",
        resourceId,
        occurredAt: "2026-07-17T12:00:00.000Z",
        includeRetired: true,
      }),
    ).toThrowError(expect.objectContaining({ code: "ANALYSIS_CRITERIA_INPUT_INVALID" }));
  });

  it("strictly delegates the protected criteria workspace read", async () => {
    const { instance, service } = controller();
    await instance.getWorkspace(request(["employee"]), { kind: "workstream", resourceId });
    expect(service.workspace.get).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      kind: "workstream",
      resourceId,
    });
    expect(() =>
      instance.getWorkspace(request(["employee"]), {
        kind: "workstream",
        resourceId,
        readinessPercentage: 90,
      }),
    ).toThrowError(expect.objectContaining({ code: "ANALYSIS_CRITERIA_INPUT_INVALID" }));
  });

  it("requires correlation before every write service call", () => {
    const { instance, service } = controller();
    const noCorrelation = { ...request(), correlationId: undefined };
    expect(() =>
      instance.publish(noCorrelation as never, proposalId, { reason: "Owner approved" }),
    ).toThrowError(expect.objectContaining({ code: "CORRELATION_ID_REQUIRED", status: 400 }));
    expect(service.proposals.reviewByOwner).not.toHaveBeenCalled();
  });

  it("declares all nine exact routes with authentication and policy guards", () => {
    expect(Reflect.getMetadata(PATH_METADATA, CriteriaController)).toBe("api/v1/dynamic-criteria");
    expect(Reflect.getMetadata(GUARDS_METADATA, CriteriaController)).toEqual([
      AnalysisCriteriaAuthenticationGuard,
    ]);
    const routes = [
      ["createProposal", 1, "proposals"],
      ["reviewByOwner", 1, ":proposalId/owner-reviews"],
      ["publish", 1, ":proposalId/publish"],
      ["respond", 1, ":proposalId/responses"],
      ["resolveByManager", 1, ":proposalId/manager-resolutions"],
      ["activate", 1, ":proposalId/activate"],
      ["revise", 1, "revisions"],
      ["getActive", 0, "active"],
      ["getWorkspace", 0, "workspace"],
    ] as const;
    for (const [method, verb, path] of routes) {
      expect(Reflect.getMetadata(METHOD_METADATA, CriteriaController.prototype[method])).toBe(verb);
      expect(Reflect.getMetadata(PATH_METADATA, CriteriaController.prototype[method])).toBe(path);
      expect(Reflect.getMetadata(GUARDS_METADATA, CriteriaController.prototype[method])).toEqual([
        AnalysisCriteriaPolicyGuard,
      ]);
      expect(
        Reflect.getMetadata(ANALYSIS_CRITERIA_POLICY_ACTION, CriteriaController.prototype[method]),
      ).toBeTypeOf("string");
    }
    expect(
      Reflect.getMetadata(
        ANALYSIS_CRITERIA_POLICY_ACTION,
        CriteriaController.prototype.getWorkspace,
      ),
    ).toBe("criteria.workspace.read");
  });
});

describe("AnalysisCriteriaPolicyGuard resource boundaries", () => {
  it("allows the current scoped owner and denies an owner assigned to another resource", async () => {
    const currentOwnerDatabase = policyDatabase({
      roles: [{ role: "workstream_owner", scopeType: "workstream", scopeId: resourceId }],
    });
    const currentOwnerGuard = new AnalysisCriteriaPolicyGuard(
      reflector("criteria.owner.review") as never,
      currentOwnerDatabase as never,
    );
    await expect(
      currentOwnerGuard.canActivate(context(request(["workstream_owner"]), { proposalId })),
    ).resolves.toBe(true);

    const otherResourceId = "00000000-0000-4000-8000-000000000099";
    const otherOwnerDatabase = policyDatabase({
      roles: [{ role: "workstream_owner", scopeType: "workstream", scopeId: otherResourceId }],
    });
    const otherOwnerGuard = new AnalysisCriteriaPolicyGuard(
      reflector("criteria.owner.review") as never,
      otherOwnerDatabase as never,
    );
    await expect(
      otherOwnerGuard.canActivate(context(request(["workstream_owner"]), { proposalId })),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH", status: 403 });
  });

  it("denies a cross-department manager and allows only the scoped manager resolution", async () => {
    const departmentScopeId = "00000000-0000-4000-8000-000000000010";
    const database = policyDatabase({
      roles: [{ role: "manager", scopeType: "department", scopeId: departmentScopeId }],
      departmentScopeId: "00000000-0000-4000-8000-000000000011",
    });
    const guard = new AnalysisCriteriaPolicyGuard(
      reflector("criteria.manager.resolve") as never,
      database as never,
    );

    await expect(
      guard.canActivate(context(request(["manager"]), { proposalId })),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH", status: 403 });

    database.authorizationScope.findFirst.mockResolvedValueOnce({ id: departmentScopeId });
    await expect(guard.canActivate(context(request(["manager"]), { proposalId }))).resolves.toBe(
      true,
    );
  });

  it("denies owner-role manager resolution and a manager detail read even with body/query manipulation", async () => {
    const ownerDatabase = policyDatabase({
      roles: [{ role: "workstream_owner", scopeType: "workstream", scopeId: resourceId }],
    });
    const ownerGuard = new AnalysisCriteriaPolicyGuard(
      reflector("criteria.manager.resolve") as never,
      ownerDatabase as never,
    );
    await expect(
      ownerGuard.canActivate(context(request(["workstream_owner"]), { proposalId })),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_REQUIRED", status: 403 });

    const managerDatabase = policyDatabase({
      roles: [
        {
          role: "manager",
          scopeType: "department",
          scopeId: "00000000-0000-4000-8000-000000000010",
        },
      ],
    });
    const detailGuard = new AnalysisCriteriaPolicyGuard(
      reflector("document.readiness.detail.read") as never,
      managerDatabase as never,
    );
    await expect(
      detailGuard.canActivate(
        context(
          request(["manager"]),
          { documentId },
          { view: "operational-state" },
          { view: "operational-state" },
        ),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("uses the immutable response snapshot and never a caller-supplied employee identity", async () => {
    const database = policyDatabase({
      roles: [{ role: "contributor", scopeType: "workstream", scopeId: resourceId }],
    });
    const guard = new AnalysisCriteriaPolicyGuard(
      reflector("criteria.contributor.respond") as never,
      database as never,
    );
    await expect(
      guard.canActivate(
        context(request(["contributor"]), { proposalId }, {}, { employeeId: "someone-else" }),
      ),
    ).resolves.toBe(true);
    expect(database.dynamicCriteriaProposal.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: proposalId } }),
    );
  });

  it("allows only a frozen eligible former contributor to read the criteria workspace", async () => {
    const database = policyDatabase({
      roles: [{ role: "employee", scopeType: "department", scopeId: crypto.randomUUID() }],
    });
    database.responsibilityWindow.findMany.mockResolvedValueOnce([]);
    const guard = new AnalysisCriteriaPolicyGuard(
      reflector("criteria.workspace.read") as never,
      database as never,
    );
    await expect(
      guard.canActivate(context(request(["employee"]), {}, { kind: "workstream", resourceId })),
    ).resolves.toBe(true);

    database.responsibilityWindow.findMany.mockResolvedValueOnce([]);
    database.dynamicCriteriaProposal.findFirst.mockResolvedValueOnce({
      state: "contributor_review",
      responses: [{ employeeId: actorId }],
      reviewSnapshot: { id: snapshotId, eligibility: [{ employeeId: actorId }] },
    });
    await expect(
      guard.canActivate(context(request(["employee"]), {}, { kind: "workstream", resourceId })),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH", status: 403 });

    for (const state of ["manager_resolution", "approved", "activated"] as const) {
      database.responsibilityWindow.findMany.mockResolvedValueOnce([]);
      database.dynamicCriteriaProposal.findFirst.mockResolvedValueOnce({
        state,
        responses: [],
        reviewSnapshot: { id: snapshotId, eligibility: [{ employeeId: actorId }] },
      });
      await expect(
        guard.canActivate(context(request(["employee"]), {}, { kind: "workstream", resourceId })),
      ).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH", status: 403 });
    }
  });
});

function reflector(action: string) {
  return { get: vi.fn(() => action) };
}

function context(
  currentRequest: ReturnType<typeof request>,
  params: Record<string, unknown>,
  query: Record<string, unknown> = {},
  body: Record<string, unknown> = {},
) {
  return {
    getHandler: () => function handler() {},
    switchToHttp: () => ({
      getRequest: () => ({ ...currentRequest, params, query, body }),
    }),
  } as never;
}

function policyDatabase(input: {
  roles: readonly {
    role: import("@evaluation/permissions").Role;
    scopeType: import("@evaluation/permissions").ScopeType;
    scopeId: string;
  }[];
  departmentScopeId?: string;
}) {
  return {
    roleAssignment: { findMany: vi.fn(async () => input.roles) },
    authorizationScope: {
      findFirst: vi.fn(async () => ({
        id: input.departmentScopeId ?? "00000000-0000-4000-8000-000000000010",
      })),
    },
    responsibilityWindow: {
      findMany: vi.fn(async () => [
        {
          projectId: null,
          workstreamId: resourceId,
          responsibilityType: "permanent",
          startsAt: new Date("2026-01-01T00:00:00.000Z"),
          endsAt: null,
        },
      ]),
    },
    documentRecord: {
      findUnique: vi.fn(async () => ({
        projectId: null,
        workstreamId: resourceId,
        workstream: {
          projectId: "00000000-0000-4000-8000-000000000020",
          project: { departmentId: "00000000-0000-4000-8000-000000000021" },
        },
      })),
    },
    project: {
      findUnique: vi.fn(async () => ({
        id: resourceId,
        departmentId: "00000000-0000-4000-8000-000000000021",
      })),
    },
    workstream: {
      findUnique: vi.fn(async () => ({
        id: resourceId,
        projectId: "00000000-0000-4000-8000-000000000020",
        project: { departmentId: "00000000-0000-4000-8000-000000000021" },
      })),
    },
    dynamicCriteriaProposal: {
      findUnique: vi.fn(async () => ({
        kind: "workstream",
        projectId: null,
        workstreamId: resourceId,
        workstream: {
          projectId: "00000000-0000-4000-8000-000000000020",
          project: { departmentId: "00000000-0000-4000-8000-000000000021" },
        },
        reviewSnapshot: {
          id: "00000000-0000-4000-8000-000000000030",
          eligibility: [{ employeeId: actorId }],
        },
      })),
      findFirst: vi.fn(async () => ({
        state: "contributor_review",
        responses: [] as { employeeId: string }[],
        reviewSnapshot: {
          id: "00000000-0000-4000-8000-000000000030",
          eligibility: [{ employeeId: actorId }],
        },
      })),
    },
  };
}
