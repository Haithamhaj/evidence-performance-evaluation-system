import { afterAll, describe, expect, it, vi } from "vitest";

import { createDatabaseClient } from "@evaluation/database";
import { CriteriaDocumentReader } from "@evaluation/documents";
import { CriteriaReviewReader } from "@evaluation/projects";

import { ActivationService, CriteriaVersionResolver } from "./activation-service.js";
import {
  CRITERIA_GENERATION_OUTPUT_SCHEMA_VERSION,
  CRITERIA_GENERATION_PROMPT_VERSION,
} from "./prompts.js";
import { RevisionService } from "./revision-service.js";

const approvedAt = new Date("2026-07-17T12:00:00.000Z");
const now = new Date("2026-07-17T12:01:00.000Z");
const firstEffectiveFrom = new Date("2026-07-17T12:02:00.000Z");
const secondEffectiveFrom = new Date("2026-07-17T12:03:00.000Z");

function createHarness(kind: "project" | "workstream" = "project") {
  const actorId = crypto.randomUUID();
  const resourceId = crypto.randomUUID();
  const parentProjectId = kind === "project" ? resourceId : crypto.randomUUID();
  const sourceDocumentVersionId = crypto.randomUUID();
  const readinessCheckId = crypto.randomUUID();
  const proposalId = crypto.randomUUID();
  const item = {
    id: crypto.randomUUID(),
    proposalId,
    position: 1,
    name: "Integrated result",
    selectionReason: "Matches the documented definition of success.",
    successLink: "Definition of success",
    expectedBehaviorOrResult: "The integrated output meets the accepted condition.",
    evaluationMethod: "Review the documented acceptance result.",
    suggestedEvidence: ["acceptance-record"],
    sourceReferences: [`document-version:${sourceDocumentVersionId}`],
  };
  const proposal = {
    id: proposalId,
    kind,
    projectId: kind === "project" ? resourceId : null,
    workstreamId: kind === "workstream" ? resourceId : null,
    sourceDocumentVersionId,
    readinessCheckId,
    priorSetId: null as string | null,
    state: "approved",
    version: 2,
    approvedAt,
    items: kind === "project" ? [item] : [item, { ...item, id: crypto.randomUUID(), position: 2 }],
  };
  const ownerApproval = {
    id: crypto.randomUUID(),
    proposalId,
    fromState: "owner_review",
    toState: "approved",
    actorId,
    reason: "Owner approved the criteria.",
    resultingVersion: 2,
    createdAt: approvedAt,
  };
  const eligibility = [
    {
      id: crypto.randomUUID(),
      snapshotId: crypto.randomUUID(),
      employeeId: actorId,
      role: "owner",
      responseRequired: false,
    },
    {
      id: crypto.randomUUID(),
      snapshotId: "",
      employeeId: crypto.randomUUID(),
      role: "contributor",
      responseRequired: true,
    },
  ];
  eligibility[1]!.snapshotId = eligibility[0]!.snapshotId;
  const snapshot = {
    id: eligibility[0]!.snapshotId,
    proposalId,
    primaryOwnerId: actorId,
    responsibilityAt: approvedAt,
    publishedAt: approvedAt,
  };
  const state = {
    proposal,
    proposalTransitions: [ownerApproval] as Record<string, unknown>[],
    snapshot: kind === "workstream" ? snapshot : null,
    eligibility: kind === "workstream" ? eligibility : [],
    responses:
      kind === "workstream"
        ? [
            {
              id: crypto.randomUUID(),
              proposalId,
              snapshotId: snapshot.id,
              employeeId: eligibility[1]!.employeeId,
              response: "acknowledge",
            },
          ]
        : [],
    managerResolution: null as Record<string, unknown> | null,
    sets: [] as Record<string, any>[],
    setTransitions: [] as Record<string, unknown>[],
    criteria: [] as Record<string, unknown>[],
    lifecycle: [] as Record<string, unknown>[],
    audits: [] as Record<string, unknown>[],
  };
  let currentDocumentVersionId: string = sourceDocumentVersionId;
  let currentReadinessCheckId: string = readinessCheckId;
  let currentLifecycleState = "ready_for_criteria_generation";
  let auditFailure = false;
  let currentOwnerId: string | null = actorId;

  const transaction = {
    $queryRaw: vi.fn(async () => []),
    dynamicCriteriaProposal: {
      findUnique: vi.fn(async () => ({ ...state.proposal })),
      update: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        state.proposal.state = String(data.state);
        state.proposal.version += Number(data.version?.increment ?? 0);
        return { ...state.proposal };
      }),
    },
    dynamicCriteriaProposalItem: {
      findMany: vi.fn(async () => state.proposal.items),
    },
    dynamicCriteriaProposalTransition: {
      findMany: vi.fn(async () => state.proposalTransitions),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: crypto.randomUUID(), createdAt: now, ...data };
        state.proposalTransitions.push(row);
        return row;
      }),
    },
    criteriaReviewSnapshot: {
      findUnique: vi.fn(async () => state.snapshot),
    },
    criteriaReviewEligibility: {
      findMany: vi.fn(async () => state.eligibility),
    },
    criteriaContributorResponse: {
      findMany: vi.fn(async () => state.responses),
    },
    criteriaManagerResolution: {
      findUnique: vi.fn(async () => state.managerResolution),
    },
    dynamicCriteriaSet: {
      findFirst: vi.fn(async () => state.sets.find((set) => set.effectiveTo === null) ?? null),
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          state.sets.find((set) => set.id === where.id) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        const row = { id: crypto.randomUUID(), createdAt: now, effectiveTo: null, ...data };
        state.sets.push(row);
        return row;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = state.sets.find((set) => set.id === where.id)!;
          Object.assign(row, data);
          return row;
        },
      ),
    },
    dynamicCriterion: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: crypto.randomUUID(), createdAt: now, ...data };
        state.criteria.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where }: { where: { criteriaSetId: string } }) =>
        state.criteria.filter((criterion) => criterion.criteriaSetId === where.criteriaSetId),
      ),
    },
    dynamicCriteriaSetTransition: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: crypto.randomUUID(), createdAt: now, ...data };
        state.setTransitions.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where }: { where: { criteriaSetId: string } }) =>
        state.setTransitions.filter(
          (transition) => transition.criteriaSetId === where.criteriaSetId,
        ),
      ),
    },
  };
  const database = {
    $transaction: vi.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => {
      const backup = structuredClone(state);
      try {
        return await callback(transaction);
      } catch (error) {
        Object.assign(state.proposal, backup.proposal);
        state.proposalTransitions.splice(
          0,
          state.proposalTransitions.length,
          ...backup.proposalTransitions,
        );
        state.eligibility.splice(0, state.eligibility.length, ...backup.eligibility);
        state.responses.splice(0, state.responses.length, ...backup.responses);
        state.sets.splice(0, state.sets.length, ...backup.sets);
        state.setTransitions.splice(0, state.setTransitions.length, ...backup.setTransitions);
        state.criteria.splice(0, state.criteria.length, ...backup.criteria);
        state.lifecycle.splice(0, state.lifecycle.length, ...backup.lifecycle);
        state.audits.splice(0, state.audits.length, ...backup.audits);
        state.snapshot = backup.snapshot;
        state.managerResolution = backup.managerResolution;
        throw error;
      }
    }),
    dynamicCriteriaSet: {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, any> }) =>
          state.sets.find(
            (set) =>
              set.kind === where.kind &&
              (where.projectId === undefined || set.projectId === where.projectId) &&
              (where.workstreamId === undefined || set.workstreamId === where.workstreamId) &&
              set.effectiveFrom <= where.effectiveFrom.lte &&
              (set.effectiveTo === null || set.effectiveTo > where.AND[0].OR[1].effectiveTo.gt),
          ) ?? null,
      ),
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          state.sets.find((set) => set.id === where.id) ?? null,
      ),
    },
  };
  const documentPort = {
    lockVersionIdentityIn: vi.fn(async () => ({
      documentId: crypto.randomUUID(),
      documentVersionId: state.proposal.sourceDocumentVersionId,
      isCurrent: state.proposal.sourceDocumentVersionId === currentDocumentVersionId,
    })),
    getPrerequisitesIn: vi.fn(async () => ({
      documentId: crypto.randomUUID(),
      documentVersionId: state.proposal.sourceDocumentVersionId,
      documentVersion: state.sets.length + 1,
      readinessCheckId: currentReadinessCheckId,
      lifecycleState: currentLifecycleState,
      projectId: kind === "project" ? parentProjectId : null,
      workstreamId: kind === "workstream" ? resourceId : null,
      sourceReferences: [`document-version:${state.proposal.sourceDocumentVersionId}`],
    })),
    appendLifecycleTransition: vi.fn(
      async (_transaction: unknown, input: Record<string, unknown>) => {
        state.lifecycle.push(input);
        currentLifecycleState = String(input.toState);
      },
    ),
  };
  const audit = {
    append: vi.fn(async (_transaction: unknown, input: Record<string, unknown>) => {
      if (auditFailure) throw new Error("audit unavailable");
      state.audits.push(input);
      return { id: crypto.randomUUID(), createdAt: now.toISOString() };
    }),
  };
  const reviewReader = {
    snapshotIn: vi.fn(async () =>
      currentOwnerId === null
        ? null
        : {
            kind,
            resourceId,
            projectId: parentProjectId,
            organizationId: crypto.randomUUID(),
            departmentId: crypto.randomUUID(),
            primaryOwnerId: currentOwnerId,
            contributorIds: [],
          },
    ),
  };
  const activation = new ActivationService(
    database as never,
    audit as never,
    documentPort as never,
    reviewReader,
    {
      now: () => now,
    },
  );
  const resolver = new CriteriaVersionResolver(database as never);

  function command(effectiveFrom = firstEffectiveFrom) {
    return {
      actor: { userId: actorId, active: true },
      correlationId: crypto.randomUUID(),
      proposalId: state.proposal.id,
      activation: {
        expectedProposalVersion: state.proposal.version,
        effectiveFrom: effectiveFrom.toISOString(),
        reason: "Activate the approved criteria prospectively.",
      },
    };
  }

  function installNextProposal(priorSetId: string) {
    const nextProposalId = crypto.randomUUID();
    currentDocumentVersionId = crypto.randomUUID();
    currentReadinessCheckId = crypto.randomUUID();
    currentLifecycleState = "revision_required";
    Object.assign(state.proposal, {
      id: nextProposalId,
      sourceDocumentVersionId: currentDocumentVersionId,
      readinessCheckId: currentReadinessCheckId,
      priorSetId,
      state: "approved",
      version: 2,
      approvedAt: new Date("2026-07-17T12:01:30.000Z"),
      items: state.proposal.items.map((entry) => ({
        ...entry,
        id: crypto.randomUUID(),
        proposalId: nextProposalId,
      })),
    });
    state.proposalTransitions.splice(0, state.proposalTransitions.length, {
      ...ownerApproval,
      id: crypto.randomUUID(),
      proposalId: nextProposalId,
    });
    if (state.snapshot !== null) state.snapshot.proposalId = nextProposalId;
    for (const response of state.responses) response.proposalId = nextProposalId;
  }

  return {
    activation,
    actorId,
    audit,
    command,
    documentPort,
    reviewReader,
    installNextProposal,
    proposal,
    resolver,
    resourceId,
    state,
    setAuditFailure(value: boolean) {
      auditFailure = value;
    },
    setCurrentDocumentVersion(value: string) {
      currentDocumentVersionId = value;
    },
    setCurrentOwner(value: string | null) {
      currentOwnerId = value;
    },
  };
}

describe("ActivationService", () => {
  it("atomically activates approved criteria and advances readiness without changing content", async () => {
    const harness = createHarness();
    const beforeItems = structuredClone(harness.proposal.items);

    await expect(harness.activation.activate(harness.command())).resolves.toMatchObject({
      kind: "project",
      version: 1,
      effectiveFrom: firstEffectiveFrom,
      effectiveTo: null,
    });
    expect(harness.state.proposal).toMatchObject({ state: "activated", version: 3 });
    expect(harness.state.criteria).toHaveLength(1);
    expect(harness.state.setTransitions).toEqual([
      expect.objectContaining({ kind: "activated", effectiveAt: firstEffectiveFrom }),
    ]);
    expect(harness.state.lifecycle).toEqual([
      expect.objectContaining({
        toState: "criteria_approved",
        criteriaSetId: harness.state.sets[0]!.id,
      }),
    ]);
    expect(harness.state.audits).toHaveLength(1);
    expect(harness.proposal.items).toEqual(beforeItems);
  });

  it("activates approved workstream criteria against its workstream document lineage", async () => {
    const harness = createHarness("workstream");

    await expect(harness.activation.activate(harness.command())).resolves.toMatchObject({
      kind: "workstream",
      projectId: null,
      workstreamId: harness.resourceId,
      version: 1,
    });
  });

  it("denies the historical approver after current ownership transfers", async () => {
    const harness = createHarness();
    harness.setCurrentOwner(crypto.randomUUID());

    await expect(harness.activation.activate(harness.command())).rejects.toMatchObject({
      code: "CRITERIA_ACTIVATION_FORBIDDEN",
    });
  });

  it("allows the current owner after transfer while retaining historical approval", async () => {
    const harness = createHarness();
    const currentOwnerId = crypto.randomUUID();
    harness.setCurrentOwner(currentOwnerId);
    const command = harness.command();

    await expect(
      harness.activation.activate({
        ...command,
        actor: { userId: currentOwnerId, active: true },
      }),
    ).resolves.toMatchObject({ kind: "project", version: 1 });
  });

  it("denies activation after an acting-owner window expires", async () => {
    const harness = createHarness();
    harness.setCurrentOwner(null);

    await expect(harness.activation.activate(harness.command())).rejects.toMatchObject({
      code: "CRITERIA_ACTIVATION_FORBIDDEN",
    });
  });

  it("retires the prior set and resolves exact half-open UTC boundaries", async () => {
    const harness = createHarness();
    const first = await harness.activation.activate(harness.command());
    harness.installNextProposal(first.id);
    const second = await harness.activation.activate(harness.command(secondEffectiveFrom));

    expect(harness.state.sets[0]).toMatchObject({ effectiveTo: secondEffectiveFrom });
    expect(harness.state.setTransitions).toContainEqual(
      expect.objectContaining({
        criteriaSetId: first.id,
        kind: "retired",
        effectiveAt: secondEffectiveFrom,
      }),
    );
    await expect(
      harness.resolver.resolve({
        kind: "project",
        resourceId: harness.resourceId,
        occurredAt: new Date(secondEffectiveFrom.getTime() - 1),
      }),
    ).resolves.toMatchObject({ id: first.id, version: 1 });
    await expect(
      harness.resolver.resolve({
        kind: "project",
        resourceId: harness.resourceId,
        occurredAt: secondEffectiveFrom,
      }),
    ).resolves.toMatchObject({ id: second.id, version: 2 });
    await expect(
      harness.resolver.assertLink({
        criteriaSetId: second.id,
        kind: "project",
        resourceId: harness.resourceId,
        occurredAt: new Date(secondEffectiveFrom.getTime() - 1),
      }),
    ).rejects.toMatchObject({ code: "RETROACTIVE_CRITERIA_FORBIDDEN" });
  });

  it("rolls back activation when the current document changed", async () => {
    const harness = createHarness("workstream");
    harness.setCurrentDocumentVersion(crypto.randomUUID());
    await expect(harness.activation.activate(harness.command())).rejects.toBeDefined();
    expect(harness.state.sets).toEqual([]);
    expect(harness.state.setTransitions).toEqual([]);
    expect(harness.state.lifecycle).toEqual([]);
    expect(harness.state.proposal).toMatchObject({ state: "approved", version: 2 });
  });

  it("rolls back activation when a frozen contributor response is missing", async () => {
    const harness = createHarness("workstream");
    harness.state.responses.splice(0);
    await expect(harness.activation.activate(harness.command())).rejects.toBeDefined();
    expect(harness.state.sets).toEqual([]);
    expect(harness.state.lifecycle).toEqual([]);
    expect(harness.state.proposal).toMatchObject({ state: "approved", version: 2 });
  });

  it("rolls back activation when an objection lacks manager acceptance", async () => {
    const harness = createHarness("workstream");
    harness.state.responses[0]!.response = "object";
    await expect(harness.activation.activate(harness.command())).rejects.toBeDefined();
    expect(harness.state.sets).toEqual([]);
    expect(harness.state.lifecycle).toEqual([]);
    expect(harness.state.proposal).toMatchObject({ state: "approved", version: 2 });
  });

  it("rolls back activation when the same-transaction audit fails", async () => {
    const harness = createHarness("workstream");
    harness.setAuditFailure(true);
    await expect(harness.activation.activate(harness.command())).rejects.toBeDefined();
    expect(harness.state.sets).toEqual([]);
    expect(harness.state.lifecycle).toEqual([]);
    expect(harness.state.proposal).toMatchObject({ state: "approved", version: 2 });
  });
});

const activationTestDatabaseUrl = process.env.TEST_DATABASE_URL ?? "";
const hasSafeActivationDatabase = /\/evaluation_phase1_test(?:\?|$)/u.test(
  activationTestDatabaseUrl,
);
const activationDatabase = createDatabaseClient(activationTestDatabaseUrl);

afterAll(async () => activationDatabase.$disconnect());

describe.runIf(hasSafeActivationDatabase)("ActivationService PostgreSQL protocol", () => {
  it("commits activation, append-only readiness, audit, and trigger transitions atomically", async () => {
    const fixture = await seedActivationFixture();
    const service = postgresActivationService(fixture.now);
    const result = await service.activate(activationCommand(fixture));

    expect(result).toMatchObject({
      kind: "project",
      projectId: fixture.projectId,
      version: 1,
      priorSetId: null,
    });
    await expect(
      activationDatabase.dynamicCriteriaSetTransition.findMany({
        where: { criteriaSetId: result.id },
        select: { kind: true, effectiveAt: true },
      }),
    ).resolves.toEqual([{ kind: "activated", effectiveAt: fixture.effectiveFrom }]);
    await expect(
      activationDatabase.documentReadinessLifecycleTransition.findMany({
        where: { readinessCheckId: fixture.readinessCheckId },
        orderBy: [{ effectiveAt: "asc" }, { id: "asc" }],
        select: { fromState: true, toState: true, criteriaSetId: true },
      }),
    ).resolves.toEqual([
      {
        fromState: "draft",
        toState: "ready_for_criteria_generation",
        criteriaSetId: null,
      },
      {
        fromState: "ready_for_criteria_generation",
        toState: "criteria_approved",
        criteriaSetId: result.id,
      },
    ]);
    await expect(
      activationDatabase.auditEvent.count({
        where: { eventType: "dynamic_criteria.activated", targetId: result.id },
      }),
    ).resolves.toBe(1);
  });

  it("activates a frozen workstream proposal against its parent-project document lineage", async () => {
    const fixture = await seedActivationFixture("workstream");
    const result = await postgresActivationService(fixture.now).activate(
      activationCommand(fixture),
    );

    expect(result).toMatchObject({
      kind: "workstream",
      projectId: null,
      workstreamId: fixture.workstreamId,
      version: 1,
    });
    await expect(
      activationDatabase.dynamicCriterion.count({ where: { criteriaSetId: result.id } }),
    ).resolves.toBe(2);
  });

  it("re-resolves transferred ownership in the activation transaction", async () => {
    const fixture = await seedActivationFixture();
    const newOwner = await activationDatabase.user.create({
      data: {
        email: `activation-new-owner-${crypto.randomUUID()}@example.invalid`,
        displayName: "Activation New Owner",
      },
    });
    await activationDatabase.$transaction(async (transaction) => {
      await transaction.responsibilityWindow.update({
        where: { id: fixture.responsibilityWindowId },
        data: { endsAt: fixture.now },
      });
      const newWindow = await transaction.responsibilityWindow.create({
        data: {
          employeeId: newOwner.id,
          projectId: fixture.projectId,
          responsibilityType: "permanent",
          startsAt: fixture.now,
          reason: "Permanent ownership transfer",
          managerDecisionById: fixture.ownerId,
          managerDecisionAt: fixture.now,
          managerDecisionReason: "Transfer ownership before activation",
          createdById: fixture.ownerId,
        },
      });
      await transaction.ownershipTransfer.create({
        data: {
          projectId: fixture.projectId,
          transferKind: "permanent",
          closedWindowId: fixture.responsibilityWindowId,
          newOwnerWindowId: newWindow.id,
          effectiveAt: fixture.now,
          reason: "Permanent ownership transfer",
          managerDecisionById: fixture.ownerId,
          managerDecisionAt: fixture.now,
          managerDecisionReason: "Transfer ownership before activation",
        },
      });
    });
    const service = postgresActivationService(fixture.now);

    await expect(service.activate(activationCommand(fixture))).rejects.toMatchObject({
      code: "CRITERIA_ACTIVATION_FORBIDDEN",
    });
    await expect(
      service.activate({
        ...activationCommand(fixture),
        actor: { userId: newOwner.id, active: true },
      }),
    ).resolves.toMatchObject({ projectId: fixture.projectId, version: 1 });
  });

  it("denies an acting owner at the exact half-open end boundary", async () => {
    const fixture = await seedActivationFixture();
    const actingOwner = await activationDatabase.user.create({
      data: {
        email: `activation-expired-acting-${crypto.randomUUID()}@example.invalid`,
        displayName: "Expired Acting Owner",
      },
    });
    await activationDatabase.responsibilityWindow.update({
      where: { id: fixture.responsibilityWindowId },
      data: { endsAt: new Date(fixture.now.getTime() - 60_000) },
    });
    await activationDatabase.responsibilityWindow.create({
      data: {
        employeeId: actingOwner.id,
        projectId: fixture.projectId,
        responsibilityType: "acting",
        startsAt: new Date(fixture.now.getTime() - 30_000),
        endsAt: fixture.now,
        reason: "Acting ownership ending at the activation boundary",
        delegationType: "planned_leave",
        managerDecisionById: fixture.ownerId,
        managerDecisionAt: new Date(fixture.now.getTime() - 30_000),
        managerDecisionReason: "Cover the project until the boundary",
        createdById: fixture.ownerId,
      },
    });

    await expect(
      postgresActivationService(fixture.now).activate({
        ...activationCommand(fixture),
        actor: { userId: actingOwner.id, active: true },
      }),
    ).rejects.toMatchObject({ code: "CRITERIA_ACTIVATION_FORBIDDEN" });
    await expect(
      activationDatabase.dynamicCriteriaSet.count({ where: { proposalId: fixture.proposalId } }),
    ).resolves.toBe(0);
  });

  it("retires the prior set at the exact next-version boundary", async () => {
    const fixture = await seedActivationFixture();
    const service = postgresActivationService(fixture.now);
    const first = await service.activate(activationCommand(fixture));
    const revisionAt = new Date(fixture.effectiveFrom.getTime() + 1);
    const secondEffectiveFrom = new Date(fixture.effectiveFrom.getTime() + 30_000);
    await new CriteriaDocumentReader(activationDatabase).appendLifecycleTransition(
      activationDatabase as never,
      {
        readinessCheckId: fixture.readinessCheckId,
        documentVersionId: fixture.documentVersionId,
        fromState: "criteria_approved",
        toState: "revision_required",
        actorId: fixture.ownerId,
        reason: "Reviewed revision fixture",
        effectiveAt: revisionAt,
      },
    );
    const secondProposal = await seedApprovedProposal({
      suffix: crypto.randomUUID(),
      number: 2,
      kind: "project",
      ownerId: fixture.ownerId,
      contributorId: null,
      organizationId: fixture.organizationId,
      projectId: fixture.projectId,
      workstreamId: null,
      documentId: fixture.documentId,
      documentVersionId: fixture.documentVersionId,
      readinessCheckId: fixture.readinessCheckId,
      approvedAt: revisionAt,
      priorSetId: first.id,
    });
    const second = await service.activate({
      actor: { userId: fixture.ownerId, active: true },
      correlationId: crypto.randomUUID(),
      proposalId: secondProposal.id,
      activation: {
        expectedProposalVersion: secondProposal.version,
        effectiveFrom: secondEffectiveFrom.toISOString(),
        reason: "Activate the revised criteria prospectively.",
      },
    });

    await expect(
      activationDatabase.dynamicCriteriaSet.findUniqueOrThrow({
        where: { id: first.id },
        select: { effectiveTo: true },
      }),
    ).resolves.toEqual({ effectiveTo: secondEffectiveFrom });
    await expect(
      activationDatabase.dynamicCriteriaSetTransition.findUniqueOrThrow({
        where: { criteriaSetId_kind: { criteriaSetId: first.id, kind: "retired" } },
        select: { effectiveAt: true },
      }),
    ).resolves.toEqual({ effectiveAt: secondEffectiveFrom });
    expect(second).toMatchObject({ priorSetId: first.id, version: 2 });
  });

  it("rolls back every activation write when the same-transaction audit fails", async () => {
    const fixture = await seedActivationFixture();
    const failingAudit = {
      append: async () => {
        throw new Error("audit unavailable");
      },
    };
    const service = new ActivationService(
      activationDatabase,
      failingAudit as never,
      new CriteriaDocumentReader(activationDatabase),
      new CriteriaReviewReader(activationDatabase),
      { now: () => fixture.now },
    );

    await expect(service.activate(activationCommand(fixture))).rejects.toThrow("audit unavailable");
    await expect(
      activationDatabase.dynamicCriteriaSet.count({ where: { proposalId: fixture.proposalId } }),
    ).resolves.toBe(0);
    await expect(
      activationDatabase.dynamicCriteriaProposal.findUniqueOrThrow({
        where: { id: fixture.proposalId },
        select: { state: true, version: true },
      }),
    ).resolves.toEqual({ state: "approved", version: 2 });
    await expect(
      activationDatabase.documentReadinessLifecycleTransition.count({
        where: {
          readinessCheckId: fixture.readinessCheckId,
          toState: "criteria_approved",
        },
      }),
    ).resolves.toBe(0);
  });

  it("maps concurrent overlapping activation to one set and VERSION_CONFLICT", async () => {
    const fixture = await seedActivationFixture();
    const competingProposalId = await seedCompetingApprovedProposal(fixture);
    const secondDatabase = createDatabaseClient(activationTestDatabaseUrl);
    const services = [
      postgresActivationService(fixture.now),
      new ActivationService(
        secondDatabase,
        postgresAuditWriter(),
        new CriteriaDocumentReader(secondDatabase),
        new CriteriaReviewReader(secondDatabase),
        { now: () => fixture.now },
      ),
    ] as const;
    try {
      const outcomes = await Promise.allSettled([
        services[0].activate(activationCommand(fixture)),
        services[1].activate({
          ...activationCommand(fixture),
          proposalId: competingProposalId,
        }),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
      expect(outcomes.find((outcome) => outcome.status === "rejected")).toMatchObject({
        status: "rejected",
        reason: { code: "VERSION_CONFLICT" },
      });
      await expect(
        activationDatabase.dynamicCriteriaSet.count({
          where: { projectId: fixture.projectId, effectiveTo: null },
        }),
      ).resolves.toBe(1);
    } finally {
      await secondDatabase.$disconnect();
    }
  });
});

describe.runIf(hasSafeActivationDatabase)("RevisionService PostgreSQL protocol", () => {
  it("persists one revision request and returns its exact receipt without duplicate effects", async () => {
    const fixture = await seedRevisionFixture();
    const idempotencyKey = `criteria-revision-${crypto.randomUUID()}`;
    const command = revisionCommand(fixture, idempotencyKey);
    const service = postgresRevisionService(fixture.revisionAt);

    const first = await service.start(command);
    await expect(service.start(command)).resolves.toEqual(first);
    await expect(
      service.start({
        ...command,
        revision: { ...command.revision, reason: "A conflicting revision purpose." },
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });

    const newOwner = await activationDatabase.user.create({
      data: {
        email: `revision-new-owner-${crypto.randomUUID()}@example.invalid`,
        displayName: "Revision New Owner",
      },
    });
    await activationDatabase.$transaction(async (transaction) => {
      await transaction.responsibilityWindow.update({
        where: { id: fixture.responsibilityWindowId },
        data: { endsAt: fixture.revisionAt },
      });
      const newWindow = await transaction.responsibilityWindow.create({
        data: {
          employeeId: newOwner.id,
          projectId: fixture.projectId,
          responsibilityType: "permanent",
          startsAt: fixture.revisionAt,
          reason: "Permanent ownership transfer before revision replay",
          managerDecisionById: fixture.ownerId,
          managerDecisionAt: fixture.revisionAt,
          managerDecisionReason: "Transfer revision authority",
          createdById: fixture.ownerId,
        },
      });
      await transaction.ownershipTransfer.create({
        data: {
          projectId: fixture.projectId,
          transferKind: "permanent",
          closedWindowId: fixture.responsibilityWindowId,
          newOwnerWindowId: newWindow.id,
          effectiveAt: fixture.revisionAt,
          reason: "Permanent ownership transfer before revision replay",
          managerDecisionById: fixture.ownerId,
          managerDecisionAt: fixture.revisionAt,
          managerDecisionReason: "Transfer revision authority",
        },
      });
    });
    await expect(service.start(command)).rejects.toMatchObject({
      code: "CRITERIA_REVISION_FORBIDDEN",
    });

    await expect(
      activationDatabase.documentAnalysisRequest.count({ where: { idempotencyKey } }),
    ).resolves.toBe(1);
    await expect(
      activationDatabase.documentReadinessLifecycleTransition.count({
        where: {
          comparisonReviewId: fixture.comparisonReviewId,
          toState: "revision_required",
        },
      }),
    ).resolves.toBe(1);
    await expect(
      activationDatabase.operation.count({
        where: { idempotencyKey: `criteria:${idempotencyKey}` },
      }),
    ).resolves.toBe(1);
    await expect(
      activationDatabase.operationEffectReceipt.count({
        where: { idempotencyKey: `outbox:${idempotencyKey}` },
      }),
    ).resolves.toBe(1);
    await expect(
      activationDatabase.auditEvent.count({
        where: {
          eventType: "dynamic_criteria.revision_requested",
          targetId: first.requestId,
        },
      }),
    ).resolves.toBe(1);
  });

  it("rolls back the request, lifecycle, operation, outbox receipt, and audit together", async () => {
    const fixture = await seedRevisionFixture();
    const idempotencyKey = `criteria-revision-rollback-${crypto.randomUUID()}`;
    const service = new RevisionService(
      activationDatabase,
      new CriteriaDocumentReader(activationDatabase),
      new CriteriaReviewReader(activationDatabase),
      {
        append: async () => {
          throw new Error("revision audit unavailable");
        },
      } as never,
      postgresRevisionOutboxWriter(),
      { now: () => fixture.revisionAt },
    );

    await expect(service.start(revisionCommand(fixture, idempotencyKey))).rejects.toThrow(
      "revision audit unavailable",
    );
    await expect(
      activationDatabase.documentAnalysisRequest.count({ where: { idempotencyKey } }),
    ).resolves.toBe(0);
    await expect(
      activationDatabase.documentReadinessLifecycleTransition.count({
        where: {
          comparisonReviewId: fixture.comparisonReviewId,
          toState: "revision_required",
        },
      }),
    ).resolves.toBe(0);
    await expect(
      activationDatabase.operation.count({
        where: { idempotencyKey: `criteria:${idempotencyKey}` },
      }),
    ).resolves.toBe(0);
    await expect(
      activationDatabase.operationEffectReceipt.count({
        where: { idempotencyKey: `outbox:${idempotencyKey}` },
      }),
    ).resolves.toBe(0);
    await expect(
      activationDatabase.auditEvent.count({
        where: {
          eventType: "dynamic_criteria.revision_requested",
          scopeId: fixture.projectId,
        },
      }),
    ).resolves.toBe(0);
  });
});

type ActivationFixture = Awaited<ReturnType<typeof seedActivationFixture>>;
type RevisionFixture = Awaited<ReturnType<typeof seedRevisionFixture>>;

function postgresActivationService(at: Date) {
  return new ActivationService(
    activationDatabase,
    postgresAuditWriter(),
    new CriteriaDocumentReader(activationDatabase),
    new CriteriaReviewReader(activationDatabase),
    { now: () => at },
  );
}

function postgresRevisionService(at: Date) {
  return new RevisionService(
    activationDatabase,
    new CriteriaDocumentReader(activationDatabase),
    new CriteriaReviewReader(activationDatabase),
    postgresAuditWriter(),
    postgresRevisionOutboxWriter(),
    { now: () => at },
  );
}

function postgresRevisionOutboxWriter() {
  return {
    append: async (
      transaction: import("./model.js").CriteriaTransaction,
      input: Readonly<{ operationId: string; idempotencyKey: string; jobType: string }>,
    ) =>
      transaction.operationEffectReceipt.create({
        data: {
          operationId: input.operationId,
          effectName: "outbox-enqueued",
          idempotencyKey: `outbox:${input.idempotencyKey}`,
          receiptReference: `${input.jobType}:${input.operationId}`,
        },
      }),
  };
}

function activationCommand(fixture: ActivationFixture) {
  return {
    actor: { userId: fixture.ownerId, active: true },
    correlationId: crypto.randomUUID(),
    proposalId: fixture.proposalId,
    activation: {
      expectedProposalVersion: fixture.proposalVersion,
      effectiveFrom: fixture.effectiveFrom.toISOString(),
      reason: "Activate approved criteria prospectively.",
    },
  };
}

function revisionCommand(fixture: RevisionFixture, idempotencyKey: string) {
  return {
    actor: { userId: fixture.ownerId, active: true },
    correlationId: crypto.randomUUID(),
    kind: "project" as const,
    resourceId: fixture.projectId,
    idempotencyKey,
    revision: {
      comparisonReviewId: fixture.comparisonReviewId,
      reason: "Regenerate criteria for the reviewed material change.",
    },
  };
}

async function seedActivationFixture(kind: "project" | "workstream" = "project") {
  const suffix = crypto.randomUUID();
  const now = new Date();
  const effectiveFrom = new Date(now.getTime() + 30_000);
  const owner = await activationDatabase.user.create({
    data: {
      email: `activation-owner-${suffix}@example.invalid`,
      displayName: "Activation Owner",
    },
  });
  const contributor =
    kind === "workstream"
      ? await activationDatabase.user.create({
          data: {
            email: `activation-contributor-${suffix}@example.invalid`,
            displayName: "Activation Contributor",
          },
        })
      : null;
  const organization = await activationDatabase.organization.create({
    data: { key: `activation-org-${suffix}`, name: "Activation Organization" },
  });
  const department = await activationDatabase.department.create({
    data: {
      key: `activation-department-${suffix}`,
      name: "Activation Department",
      organizationId: organization.id,
    },
  });
  const projectId = crypto.randomUUID();
  await activationDatabase.authorizationScope.create({
    data: {
      id: projectId,
      key: `activation-project-${suffix}`,
      scopeType: "project",
      departmentId: department.id,
    },
  });
  await activationDatabase.project.create({
    data: {
      id: projectId,
      organizationId: organization.id,
      departmentId: department.id,
      authorizationScopeId: projectId,
      authorizationScopeType: "project",
      name: "Activation Project",
      description: "Activation PostgreSQL fixture",
      status: "active",
      createdById: owner.id,
    },
  });
  const workstreamId = kind === "workstream" ? crypto.randomUUID() : null;
  if (workstreamId !== null) {
    await activationDatabase.authorizationScope.create({
      data: {
        id: workstreamId,
        key: `activation-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId: department.id,
      },
    });
    await activationDatabase.workstream.create({
      data: {
        id: workstreamId,
        projectId,
        authorizationScopeId: workstreamId,
        authorizationScopeType: "workstream",
        name: "Activation Workstream",
        description: "Activation PostgreSQL workstream fixture",
        status: "active",
        createdById: owner.id,
      },
    });
  }
  const responsibility = await activationDatabase.responsibilityWindow.create({
    data: {
      employeeId: owner.id,
      ...(workstreamId === null ? { projectId } : { workstreamId }),
      responsibilityType: "original",
      startsAt: new Date(now.getTime() - 86_400_000),
      reason: "Initial owner",
      managerDecisionById: owner.id,
      managerDecisionAt: new Date(now.getTime() - 86_400_000),
      managerDecisionReason: "Initial ownership",
      createdById: owner.id,
    },
  });
  const template = await activationDatabase.documentTemplate.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      scopeType: "department",
      kind,
      createdById: owner.id,
      versions: {
        create: {
          version: 1,
          status: "active",
          reason: "Activation fixture",
          createdById: owner.id,
          activatedAt: now,
        },
      },
    },
    include: { versions: true },
  });
  const document = await activationDatabase.documentRecord.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      ...(workstreamId === null ? { projectId } : { workstreamId }),
      templateVersionId: template.versions[0]!.id,
      currentVersion: 1,
      createdById: owner.id,
      versions: {
        create: {
          version: 1,
          templateVersionId: template.versions[0]!.id,
          reason: "Activation fixture",
          createdById: owner.id,
        },
      },
    },
    include: { versions: true },
  });
  const readinessArtifacts = await seedActivationArtifacts(
    owner.id,
    "document.analyze",
    `activation-readiness-${suffix}`,
  );
  const readinessOperationId = crypto.randomUUID();
  await activationDatabase.operation.create({
    data: {
      id: readinessOperationId,
      organizationId: organization.id,
      jobType: "document.readiness",
      jobVersion: 1,
      idempotencyKey: `activation-readiness-operation-${suffix}`,
      correlationId: crypto.randomUUID(),
      payloadHash: "1".repeat(64),
    },
  });
  const readinessRequest = await activationDatabase.documentAnalysisRequest.create({
    data: {
      kind: "readiness",
      idempotencyKey: `activation-readiness-request-${suffix}`,
      payloadHash: "2".repeat(64),
      routeKey: "document.analyze",
      documentId: document.id,
      currentDocumentVersionId: document.versions[0]!.id,
      expectedAggregateVersion: 1,
      outputSchemaArtifactId: readinessArtifacts.schema.id,
      outputSchemaVersion: readinessArtifacts.schema.version,
      outputSchemaHash: readinessArtifacts.schema.schemaHash,
      promptArtifactId: readinessArtifacts.prompt.id,
      promptVersion: readinessArtifacts.prompt.version,
      promptHash: readinessArtifacts.prompt.bodyHash,
      operationId: readinessOperationId,
      state: "running",
      startedAt: now,
    },
  });
  const readinessReference = `activation-readiness:${crypto.randomUUID()}`;
  const readiness = await activationDatabase.documentReadinessCheck.create({
    data: {
      requestId: readinessRequest.id,
      documentId: document.id,
      documentVersionId: document.versions[0]!.id,
      templateVersionId: template.versions[0]!.id,
      analyzedState: "ready_for_criteria_generation",
      managerState: "ready",
      extractionCoverage: "complete",
      output: { state: "ready_for_criteria_generation" },
      outputReference: readinessReference,
      inputSchemaVersion: "document-readiness-input.v1",
      outputSchemaVersion: readinessArtifacts.schema.version,
      promptVersion: readinessArtifacts.prompt.version,
      promptHash: readinessArtifacts.prompt.bodyHash,
      validationOutcome: "valid",
      sourceReferences: [`document-version:${document.versions[0]!.id}`],
      createdById: owner.id,
      lifecycleTransitions: {
        create: {
          documentVersionId: document.versions[0]!.id,
          fromState: "draft",
          toState: "ready_for_criteria_generation",
          actorId: owner.id,
          reason: "Ready activation fixture",
          effectiveAt: now,
        },
      },
    },
  });
  await activationDatabase.documentAnalysisRequest.update({
    where: { id: readinessRequest.id },
    data: { state: "succeeded", resultReference: readinessReference, completedAt: now },
  });
  const proposal = await seedApprovedProposal({
    suffix,
    number: 1,
    kind,
    ownerId: owner.id,
    contributorId: contributor?.id ?? null,
    organizationId: organization.id,
    projectId,
    workstreamId,
    documentId: document.id,
    documentVersionId: document.versions[0]!.id,
    readinessCheckId: readiness.id,
    approvedAt: now,
    priorSetId: null,
  });
  return {
    now,
    effectiveFrom,
    ownerId: owner.id,
    contributorId: contributor?.id ?? null,
    organizationId: organization.id,
    departmentId: department.id,
    projectId,
    workstreamId,
    responsibilityWindowId: responsibility.id,
    documentId: document.id,
    documentVersionId: document.versions[0]!.id,
    readinessCheckId: readiness.id,
    proposalId: proposal.id,
    proposalVersion: proposal.version,
  };
}

async function seedRevisionFixture() {
  const fixture = await seedActivationFixture();
  await postgresActivationService(fixture.now).activate(activationCommand(fixture));
  const revisionAt = new Date(fixture.effectiveFrom.getTime() + 1_000);
  const suffix = crypto.randomUUID();
  const firstVersion = await activationDatabase.documentVersion.findUniqueOrThrow({
    where: { id: fixture.documentVersionId },
    select: { templateVersionId: true },
  });
  const afterVersion = await activationDatabase.$transaction(async (transaction) => {
    const created = await transaction.documentVersion.create({
      data: {
        documentId: fixture.documentId,
        version: 2,
        templateVersionId: firstVersion.templateVersionId,
        reason: "Material scope revision fixture",
        createdById: fixture.ownerId,
      },
    });
    await transaction.documentRecord.update({
      where: { id: fixture.documentId },
      data: { currentVersion: 2 },
    });
    return created;
  });

  const readinessArtifacts = await seedActivationArtifacts(
    fixture.ownerId,
    "document.analyze",
    `revision-readiness-${suffix}`,
  );
  const readinessOperation = await activationDatabase.operation.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      jobType: "document.readiness",
      jobVersion: 1,
      idempotencyKey: `revision-readiness-operation-${suffix}`,
      correlationId: crypto.randomUUID(),
      payloadHash: "5".repeat(64),
    },
  });
  const readinessRequest = await activationDatabase.documentAnalysisRequest.create({
    data: {
      kind: "readiness",
      idempotencyKey: `revision-readiness-request-${suffix}`,
      payloadHash: "6".repeat(64),
      routeKey: "document.analyze",
      documentId: fixture.documentId,
      currentDocumentVersionId: afterVersion.id,
      expectedAggregateVersion: 2,
      outputSchemaArtifactId: readinessArtifacts.schema.id,
      outputSchemaVersion: readinessArtifacts.schema.version,
      outputSchemaHash: readinessArtifacts.schema.schemaHash,
      promptArtifactId: readinessArtifacts.prompt.id,
      promptVersion: readinessArtifacts.prompt.version,
      promptHash: readinessArtifacts.prompt.bodyHash,
      operationId: readinessOperation.id,
      state: "running",
      startedAt: revisionAt,
    },
  });
  const readinessReference = `revision-readiness:${crypto.randomUUID()}`;
  const readiness = await activationDatabase.documentReadinessCheck.create({
    data: {
      requestId: readinessRequest.id,
      documentId: fixture.documentId,
      documentVersionId: afterVersion.id,
      templateVersionId: firstVersion.templateVersionId,
      analyzedState: "ready_for_criteria_generation",
      managerState: "ready",
      extractionCoverage: "complete",
      output: { state: "ready_for_criteria_generation" },
      outputReference: readinessReference,
      inputSchemaVersion: "document-readiness-input.v1",
      outputSchemaVersion: readinessArtifacts.schema.version,
      promptVersion: readinessArtifacts.prompt.version,
      promptHash: readinessArtifacts.prompt.bodyHash,
      validationOutcome: "valid",
      sourceReferences: [`document-version:${afterVersion.id}`],
      createdById: fixture.ownerId,
      lifecycleTransitions: {
        create: {
          documentVersionId: afterVersion.id,
          fromState: "draft",
          toState: "ready_for_criteria_generation",
          actorId: fixture.ownerId,
          reason: "Ready material revision fixture",
          effectiveAt: new Date(revisionAt.getTime() - 1),
        },
      },
    },
  });
  await activationDatabase.documentAnalysisRequest.update({
    where: { id: readinessRequest.id },
    data: { state: "succeeded", resultReference: readinessReference, completedAt: revisionAt },
  });

  const comparisonArtifacts = await seedActivationArtifacts(
    fixture.ownerId,
    "document.compare",
    `revision-comparison-${suffix}`,
  );
  const comparisonOperation = await activationDatabase.operation.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      jobType: "document.comparison",
      jobVersion: 1,
      idempotencyKey: `revision-comparison-operation-${suffix}`,
      correlationId: crypto.randomUUID(),
      payloadHash: "7".repeat(64),
    },
  });
  const comparisonRequest = await activationDatabase.documentAnalysisRequest.create({
    data: {
      kind: "comparison",
      idempotencyKey: `revision-comparison-request-${suffix}`,
      payloadHash: "8".repeat(64),
      routeKey: "document.compare",
      documentId: fixture.documentId,
      beforeVersionId: fixture.documentVersionId,
      afterVersionId: afterVersion.id,
      expectedAggregateVersion: 2,
      outputSchemaArtifactId: comparisonArtifacts.schema.id,
      outputSchemaVersion: comparisonArtifacts.schema.version,
      outputSchemaHash: comparisonArtifacts.schema.schemaHash,
      promptArtifactId: comparisonArtifacts.prompt.id,
      promptVersion: comparisonArtifacts.prompt.version,
      promptHash: comparisonArtifacts.prompt.bodyHash,
      operationId: comparisonOperation.id,
      state: "running",
      startedAt: revisionAt,
    },
  });
  const comparison = await activationDatabase.documentComparison.create({
    data: {
      requestId: comparisonRequest.id,
      documentId: fixture.documentId,
      beforeVersionId: fixture.documentVersionId,
      afterVersionId: afterVersion.id,
      aiClassification: "material_scope_or_goal_change",
      output: { classification: "material_scope_or_goal_change" },
      outputReference: `revision-comparison:${crypto.randomUUID()}`,
      inputSchemaVersion: "document-comparison-input.v1",
      outputSchemaVersion: comparisonArtifacts.schema.version,
      promptVersion: comparisonArtifacts.prompt.version,
      promptHash: comparisonArtifacts.prompt.bodyHash,
      validationOutcome: "valid",
      stale: false,
      sourceReferences: [
        `document-version:${fixture.documentVersionId}`,
        `document-version:${afterVersion.id}`,
      ],
      createdById: fixture.ownerId,
    },
  });
  const review = await activationDatabase.documentComparisonReview.create({
    data: {
      comparisonId: comparison.id,
      effectiveClassification: "material_scope_or_goal_change",
      reviewerId: fixture.ownerId,
      reason: "The reviewed change materially alters the project scope.",
    },
  });
  await activationDatabase.documentAnalysisRequest.update({
    where: { id: comparisonRequest.id },
    data: {
      state: "succeeded",
      resultReference: comparison.outputReference,
      completedAt: revisionAt,
    },
  });
  await ensureRevisionCriteriaArtifacts(fixture.ownerId);
  return {
    ...fixture,
    revisionAt,
    afterDocumentVersionId: afterVersion.id,
    revisionReadinessCheckId: readiness.id,
    comparisonReviewId: review.id,
  };
}

async function ensureRevisionCriteriaArtifacts(actorId: string) {
  const routeKey = "criteria.generate.project";
  let schema = await activationDatabase.aiOutputSchemaArtifact.findUnique({
    where: {
      routeKey_version: {
        routeKey,
        version: CRITERIA_GENERATION_OUTPUT_SCHEMA_VERSION,
      },
    },
  });
  if (schema === null) {
    schema = await activationDatabase.aiOutputSchemaArtifact.create({
      data: {
        routeKey,
        version: CRITERIA_GENERATION_OUTPUT_SCHEMA_VERSION,
        schemaHash: "c".repeat(64),
        schemaArtifact: { type: "object" },
        reason: "Revision PostgreSQL fixture",
        expectedBehavior: "Return source-bound criteria",
        evaluationEvidenceReferences: ["test:00000000-0000-4000-8000-000000000006"],
        humanApprovalPolicy: "feature_defined",
        createdById: actorId,
      },
    });
  }
  let prompt = await activationDatabase.analysisPromptArtifact.findUnique({
    where: {
      routeKey_version: {
        routeKey,
        version: CRITERIA_GENERATION_PROMPT_VERSION,
      },
    },
  });
  if (prompt === null) {
    prompt = await activationDatabase.analysisPromptArtifact.create({
      data: {
        routeKey,
        version: CRITERIA_GENERATION_PROMPT_VERSION,
        bodyHash: "d".repeat(64),
        trustedBody: "Trusted revision fixture.",
        expectedBehavior: "Return source-bound criteria.",
        registeredById: actorId,
        registrationReason: "Revision PostgreSQL fixture",
      },
    });
  }
  return { schema, prompt };
}

async function seedCompetingApprovedProposal(fixture: ActivationFixture) {
  const proposal = await seedApprovedProposal({
    suffix: crypto.randomUUID(),
    number: 2,
    kind: "project",
    ownerId: fixture.ownerId,
    contributorId: null,
    organizationId: fixture.organizationId,
    projectId: fixture.projectId,
    workstreamId: null,
    documentId: fixture.documentId,
    documentVersionId: fixture.documentVersionId,
    readinessCheckId: fixture.readinessCheckId,
    approvedAt: fixture.now,
    priorSetId: null,
  });
  return proposal.id;
}

async function seedApprovedProposal(input: {
  suffix: string;
  number: number;
  kind: "project" | "workstream";
  ownerId: string;
  contributorId: string | null;
  organizationId: string;
  projectId: string;
  workstreamId: string | null;
  documentId: string;
  documentVersionId: string;
  readinessCheckId: string;
  approvedAt: Date;
  priorSetId: string | null;
}) {
  const artifacts = await seedActivationArtifacts(
    input.ownerId,
    `criteria.generate.${input.kind}`,
    `activation-criteria-${input.suffix}`,
  );
  const operationId = crypto.randomUUID();
  await activationDatabase.operation.create({
    data: {
      id: operationId,
      organizationId: input.organizationId,
      jobType: "analysis-criteria.process",
      jobVersion: 1,
      idempotencyKey: `activation-criteria-operation-${input.suffix}`,
      correlationId: crypto.randomUUID(),
      payloadHash: "3".repeat(64),
    },
  });
  const request = await activationDatabase.documentAnalysisRequest.create({
    data: {
      kind: input.kind === "project" ? "criteria_project" : "criteria_workstream",
      idempotencyKey: `activation-criteria-request-${input.suffix}`,
      payloadHash: "4".repeat(64),
      routeKey: `criteria.generate.${input.kind}`,
      documentId: input.documentId,
      currentDocumentVersionId: input.documentVersionId,
      pinnedReadinessCheckId: input.readinessCheckId,
      expectedAggregateVersion: 1,
      outputSchemaArtifactId: artifacts.schema.id,
      outputSchemaVersion: artifacts.schema.version,
      outputSchemaHash: artifacts.schema.schemaHash,
      promptArtifactId: artifacts.prompt.id,
      promptVersion: artifacts.prompt.version,
      promptHash: artifacts.prompt.bodyHash,
      operationId,
      state: "running",
      startedAt: input.approvedAt,
    },
  });
  const outputReference = `activation-proposal:${crypto.randomUUID()}`;
  const seeded = await activationDatabase.$transaction(async (transaction) => {
    const proposal = await transaction.dynamicCriteriaProposal.create({
      data: {
        requestId: request.id,
        kind: input.kind,
        projectId: input.kind === "project" ? input.projectId : null,
        workstreamId: input.workstreamId,
        sourceDocumentVersionId: input.documentVersionId,
        readinessCheckId: input.readinessCheckId,
        priorSetId: input.priorSetId,
        proposalNumber: input.number,
        version: 1,
        state: "owner_review",
        outputReference,
        outputSchemaVersion: artifacts.schema.version,
        promptVersion: artifacts.prompt.version,
        promptHash: artifacts.prompt.bodyHash,
        createdById: input.ownerId,
      },
    });
    await transaction.dynamicCriteriaProposalItem.create({
      data: {
        proposalId: proposal.id,
        position: 1,
        name: "Integrated result",
        selectionReason: "Matches the documented definition of success.",
        successLink: "Definition of success",
        expectedBehaviorOrResult: "The integrated output meets the accepted condition.",
        evaluationMethod: "Review the documented acceptance result.",
        suggestedEvidence: ["acceptance-record"],
        sourceReferences: [`document-version:${input.documentVersionId}`],
      },
    });
    if (input.kind === "workstream") {
      await transaction.dynamicCriteriaProposalItem.create({
        data: {
          proposalId: proposal.id,
          position: 2,
          name: "Dependency outcome",
          selectionReason: "Matches the documented dependency.",
          successLink: "Dependency decision",
          expectedBehaviorOrResult: "The dependency is resolved.",
          evaluationMethod: "Review the dependency record.",
          suggestedEvidence: ["dependency-record"],
          sourceReferences: [`document-version:${input.documentVersionId}`],
        },
      });
    }
    await transaction.documentAnalysisRequest.update({
      where: { id: request.id },
      data: { state: "succeeded", resultReference: outputReference, completedAt: input.approvedAt },
    });
    if (input.kind === "project") {
      await transaction.dynamicCriteriaProposalTransition.create({
        data: {
          proposalId: proposal.id,
          fromState: "owner_review",
          toState: "approved",
          actorId: input.ownerId,
          reason: "Owner approved the criteria.",
          resultingVersion: 2,
        },
      });
      await transaction.dynamicCriteriaProposal.update({
        where: { id: proposal.id },
        data: { state: "approved", version: 2, approvedAt: input.approvedAt },
      });
      return { id: proposal.id, version: 2 };
    }
    return { id: proposal.id, version: 1 };
  });
  if (input.kind === "project") return seeded;
  if (input.contributorId === null) throw new Error("Workstream contributor required");
  await activationDatabase.$transaction(async (transaction) => {
    await transaction.dynamicCriteriaProposalTransition.create({
      data: {
        proposalId: seeded.id,
        fromState: "owner_review",
        toState: "contributor_review",
        actorId: input.ownerId,
        reason: "Owner published the criteria for contributor review.",
        resultingVersion: 2,
      },
    });
    await transaction.dynamicCriteriaProposal.update({
      where: { id: seeded.id },
      data: { state: "contributor_review", version: 2 },
    });
    const snapshot = await transaction.criteriaReviewSnapshot.create({
      data: {
        proposalId: seeded.id,
        primaryOwnerId: input.ownerId,
        responsibilityAt: input.approvedAt,
        publishedAt: input.approvedAt,
      },
    });
    await transaction.criteriaReviewEligibility.createMany({
      data: [
        {
          snapshotId: snapshot.id,
          employeeId: input.ownerId,
          role: "owner",
          responseRequired: false,
        },
        {
          snapshotId: snapshot.id,
          employeeId: input.contributorId!,
          role: "contributor",
          responseRequired: true,
        },
      ],
    });
  });
  await activationDatabase.$transaction(async (transaction) => {
    const snapshot = await transaction.criteriaReviewSnapshot.findUniqueOrThrow({
      where: { proposalId: seeded.id },
    });
    await transaction.criteriaContributorResponse.create({
      data: {
        proposalId: seeded.id,
        snapshotId: snapshot.id,
        employeeId: input.contributorId!,
        responseRequired: true,
        response: "acknowledge",
      },
    });
    await transaction.dynamicCriteriaProposalTransition.create({
      data: {
        proposalId: seeded.id,
        fromState: "contributor_review",
        toState: "approved",
        actorId: input.ownerId,
        reason: "The frozen contributor collection completed.",
        resultingVersion: 3,
      },
    });
    await transaction.dynamicCriteriaProposal.update({
      where: { id: seeded.id },
      data: { state: "approved", version: 3, approvedAt: input.approvedAt },
    });
  });
  return { id: seeded.id, version: 3 };
}

async function seedActivationArtifacts(actorId: string, routeKey: string, version: string) {
  const schema = await activationDatabase.aiOutputSchemaArtifact.create({
    data: {
      routeKey,
      version: `${version}-output`,
      schemaHash: "a".repeat(64),
      schemaArtifact: { type: "object" },
      reason: "Activation PostgreSQL fixture",
      expectedBehavior: "Return source-bound output",
      evaluationEvidenceReferences: ["test:00000000-0000-4000-8000-000000000001"],
      humanApprovalPolicy: "feature_defined",
      createdById: actorId,
    },
  });
  const prompt = await activationDatabase.analysisPromptArtifact.create({
    data: {
      routeKey,
      version: `${version}-prompt`,
      bodyHash: "b".repeat(64),
      trustedBody: "Trusted activation fixture.",
      expectedBehavior: "Return source-bound output.",
      registeredById: actorId,
      registrationReason: "Activation PostgreSQL fixture",
    },
  });
  return { schema, prompt };
}

function postgresAuditWriter() {
  return {
    append: async (
      transaction: import("./model.js").CriteriaTransaction,
      input: import("@evaluation/contracts").AuditEventInput,
    ) => {
      const event = await transaction.auditEvent.create({
        data: {
          eventType: input.eventType,
          actorKind: input.actor.kind,
          actorId: input.actor.id,
          effectiveSubjectId: input.effectiveSubjectId,
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          targetType: input.targetType,
          targetId: input.targetId,
          ...(input.reason === undefined ? {} : { reason: input.reason }),
          ...(input.safeDiff === undefined ? {} : { safeDiff: input.safeDiff as never }),
          correlationId: input.correlationId,
          source: input.source,
        },
      });
      return { id: event.id, createdAt: event.createdAt.toISOString() };
    },
  };
}
