import { AppError } from "@evaluation/contracts";
import { describe, expect, it, vi } from "vitest";

import { WorkstreamReviewService } from "./workstream-review-service.js";

const now = new Date("2026-07-17T14:00:00.000Z");

function createHarness(contributorIds = [crypto.randomUUID(), crypto.randomUUID()]) {
  const ownerId = crypto.randomUUID();
  const workstreamId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const departmentId = crypto.randomUUID();
  const proposalId = crypto.randomUUID();
  const items = [
    { id: crypto.randomUUID(), proposalId, position: 1, name: "Criterion one" },
    { id: crypto.randomUUID(), proposalId, position: 2, name: "Criterion two" },
  ];
  const transitions: Record<string, unknown>[] = [];
  const eligibility: Record<string, unknown>[] = [];
  const responses: Record<string, unknown>[] = [];
  let snapshot: Record<string, unknown> | null = null;
  let managerResolution: Record<string, unknown> | null = null;
  const proposal = {
    id: proposalId,
    kind: "workstream",
    projectId: null,
    workstreamId,
    sourceDocumentVersionId: crypto.randomUUID(),
    state: "owner_review",
    version: 1,
    approvedAt: null as Date | null,
    items,
    transitions,
    workstream: { projectId, project: { departmentId } },
  };
  const itemUpdateMany = vi.fn();
  const transaction = {
    $queryRaw: vi.fn(async () => []),
    workstream: {
      findUnique: vi.fn(async () => ({ id: workstreamId, projectId })),
    },
    project: {
      findUnique: vi.fn(async () => ({ departmentId })),
    },
    dynamicCriteriaProposal: {
      findUnique: vi.fn(async () => ({
        ...proposal,
        items,
        transitions,
        reviewSnapshot: snapshot === null ? null : { ...snapshot, eligibility, responses },
        managerResolution,
      })),
      findUniqueOrThrow: vi.fn(async () => proposal),
      update: vi.fn(
        async ({
          data,
        }: {
          data: {
            state: string;
            version: number | { increment: number };
            approvedAt?: Date;
          };
        }) => {
          proposal.state = data.state;
          proposal.version =
            typeof data.version === "number"
              ? data.version
              : proposal.version + data.version.increment;
          if (data.approvedAt !== undefined) proposal.approvedAt = data.approvedAt;
          return {
            ...proposal,
            items,
            transitions,
            reviewSnapshot: snapshot === null ? null : { ...snapshot, eligibility, responses },
            managerResolution,
          };
        },
      ),
    },
    dynamicCriteriaProposalItem: {
      findMany: vi.fn(async () => items),
      updateMany: itemUpdateMany,
    },
    dynamicCriteriaProposalTransition: {
      findMany: vi.fn(async () => transitions),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        transitions.push({ id: crypto.randomUUID(), ...data });
        return data;
      }),
    },
    criteriaReviewSnapshot: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        snapshot = { id: crypto.randomUUID(), ...data };
        return snapshot;
      }),
      findUnique: vi.fn(async () =>
        snapshot === null ? null : { ...snapshot, eligibility, responses },
      ),
    },
    criteriaReviewEligibility: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: crypto.randomUUID(), ...data };
        eligibility.push(row);
        return row;
      }),
      createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
        eligibility.push(...data.map((row) => ({ id: crypto.randomUUID(), ...row })));
        return { count: data.length };
      }),
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { snapshotId_employeeId: { snapshotId: string; employeeId: string } };
        }) =>
          eligibility.find(
            (row) =>
              row.snapshotId === where.snapshotId_employeeId.snapshotId &&
              row.employeeId === where.snapshotId_employeeId.employeeId,
          ) ?? null,
      ),
      count: vi.fn(async () => eligibility.filter((row) => row.responseRequired).length),
      findMany: vi.fn(async () => eligibility),
    },
    criteriaContributorResponse: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { snapshotId_employeeId: { snapshotId: string; employeeId: string } };
        }) =>
          responses.find(
            (row) =>
              row.snapshotId === where.snapshotId_employeeId.snapshotId &&
              row.employeeId === where.snapshotId_employeeId.employeeId,
          ) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: crypto.randomUUID(), ...data, createdAt: now };
        responses.push(row);
        return row;
      }),
      count: vi.fn(
        async ({ where }: { where: { snapshotId: string; response?: string } }) =>
          responses.filter(
            (row) =>
              row.snapshotId === where.snapshotId &&
              (where.response === undefined || row.response === where.response),
          ).length,
      ),
      findMany: vi.fn(async () => responses),
    },
    criteriaManagerResolution: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        managerResolution = { id: crypto.randomUUID(), ...data, createdAt: now };
        return managerResolution;
      }),
      findUnique: vi.fn(async () => managerResolution),
    },
  };
  let transactionTail = Promise.resolve();
  const database = {
    $transaction: vi.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => {
      const run = transactionTail.then(() => callback(transaction));
      transactionTail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    }),
  };
  const deniedActorIds = new Set<string>();
  const policy = {
    authorize: vi.fn(
      async ({ actor }: { actor: { userId: string } }) => !deniedActorIds.has(actor.userId),
    ),
  };
  const audit = {
    append: vi.fn(async () => ({
      id: crypto.randomUUID(),
      createdAt: now.toISOString(),
    })),
  };
  const service = new WorkstreamReviewService(database as never, audit, policy, {
    now: () => now,
  });
  const identity = {
    kind: "workstream",
    resourceId: workstreamId,
    projectId,
    organizationId: crypto.randomUUID(),
    departmentId,
    primaryOwnerId: ownerId,
    contributorIds: [...contributorIds].sort(),
  } as const;

  async function publish() {
    return service.publish(transaction as never, {
      proposal,
      identity,
      actorId: ownerId,
      reason: "Publish the owner-reviewed criteria.",
      correlationId: crypto.randomUUID(),
      publishedAt: now,
    });
  }

  return {
    audit,
    contributorIds: identity.contributorIds,
    deniedActorIds,
    eligibility,
    identity,
    itemUpdateMany,
    managerId: crypto.randomUUID(),
    policy,
    projectId,
    proposal,
    proposalId,
    publish,
    responses,
    service,
    transaction,
    transitions,
    workstreamId,
    getManagerResolution: () => managerResolution,
    getSnapshot: () => snapshot,
  };
}

describe("WorkstreamReviewService", () => {
  it("freezes the publication owner and sorted active contributors for all later responses", async () => {
    const newContributorId = crypto.randomUUID();
    const harness = createHarness();
    await harness.publish();

    expect(harness.getSnapshot()).toMatchObject({
      primaryOwnerId: harness.identity.primaryOwnerId,
      responsibilityAt: now,
      publishedAt: now,
    });
    expect(
      harness.eligibility.map(({ employeeId, role, responseRequired }) => ({
        employeeId,
        role,
        responseRequired,
      })),
    ).toEqual([
      {
        employeeId: harness.identity.primaryOwnerId,
        role: "owner",
        responseRequired: false,
      },
      ...harness.contributorIds.map((employeeId) => ({
        employeeId,
        role: "contributor",
        responseRequired: true,
      })),
    ]);

    await harness.service.respond({
      actor: { userId: harness.contributorIds[0]!, active: true },
      correlationId: crypto.randomUUID(),
      proposalId: harness.proposalId,
      response: { action: "acknowledge" },
    });
    await expect(
      harness.service.respond({
        actor: { userId: newContributorId, active: true },
        correlationId: crypto.randomUUID(),
        proposalId: harness.proposalId,
        response: { action: "acknowledge" },
      }),
    ).rejects.toMatchObject({ code: "CRITERIA_RESPONSE_NOT_ELIGIBLE" });
    await expect(
      harness.service.respond({
        actor: { userId: harness.contributorIds[1]!, active: true },
        correlationId: crypto.randomUUID(),
        proposalId: harness.proposalId,
        response: { action: "object", reason: "A dependency remains unresolved." },
      }),
    ).resolves.toMatchObject({
      requiredResponses: 2,
      completedResponses: 2,
      objectionCount: 1,
      state: "manager_resolution",
    });
  });

  it("immediately approves an owner-reviewed workstream with zero contributors", async () => {
    const harness = createHarness([]);
    await expect(harness.publish()).resolves.toMatchObject({
      state: "approved",
      version: 2,
    });
    expect(harness.eligibility).toHaveLength(1);
    expect(harness.eligibility[0]).toMatchObject({
      role: "owner",
      responseRequired: false,
    });
  });

  it("records exactly one response under a deterministic duplicate race", async () => {
    const harness = createHarness([crypto.randomUUID()]);
    await harness.publish();
    const command = {
      actor: { userId: harness.contributorIds[0]!, active: true },
      correlationId: crypto.randomUUID(),
      proposalId: harness.proposalId,
      response: { action: "acknowledge" as const },
    };

    const results = await Promise.allSettled([
      harness.service.respond(command),
      harness.service.respond({ ...command, correlationId: crypto.randomUUID() }),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected?.reason).toMatchObject({
      code: "CRITERIA_RESPONSE_ALREADY_RECORDED",
    });
    expect(harness.responses).toHaveLength(1);
  });

  it("preserves objections while an authorized manager accepts with a reason", async () => {
    const harness = createHarness([crypto.randomUUID()]);
    await harness.publish();
    await harness.service.respond({
      actor: { userId: harness.contributorIds[0]!, active: true },
      correlationId: crypto.randomUUID(),
      proposalId: harness.proposalId,
      response: { action: "object", reason: "The dependency is unresolved." },
    });
    const beforeItems = structuredClone(harness.proposal.items);

    await expect(
      harness.service.resolve({
        actor: { userId: harness.managerId, active: true },
        correlationId: crypto.randomUUID(),
        proposalId: harness.proposalId,
        resolution: {
          decision: "accept_with_objections",
          reason: "Proceed while retaining the recorded objection.",
        },
      }),
    ).resolves.toMatchObject({ state: "approved", version: 4 });
    expect(harness.responses).toHaveLength(1);
    expect(harness.responses[0]).toMatchObject({
      response: "object",
      reason: "The dependency is unresolved.",
    });
    expect(harness.getManagerResolution()).toMatchObject({
      decision: "accept_with_objections",
    });
    expect(harness.itemUpdateMany).not.toHaveBeenCalled();
    expect(harness.proposal.items).toEqual(beforeItems);
  });

  it("allows only policy-authorized department managers to resolve objections", async () => {
    const harness = createHarness([crypto.randomUUID()]);
    await harness.publish();
    await harness.service.respond({
      actor: { userId: harness.contributorIds[0]!, active: true },
      correlationId: crypto.randomUUID(),
      proposalId: harness.proposalId,
      response: { action: "object", reason: "The dependency is unresolved." },
    });
    harness.deniedActorIds.add(harness.managerId);

    await expect(
      harness.service.resolve({
        actor: { userId: harness.managerId, active: true },
        correlationId: crypto.randomUUID(),
        proposalId: harness.proposalId,
        resolution: {
          decision: "request_revision",
          reason: "Revise the document and criteria.",
        },
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(harness.getManagerResolution()).toBeNull();
  });

  it("records a revision resolution and supersedes without mutating content", async () => {
    const harness = createHarness([crypto.randomUUID()]);
    await harness.publish();
    await harness.service.respond({
      actor: { userId: harness.contributorIds[0]!, active: true },
      correlationId: crypto.randomUUID(),
      proposalId: harness.proposalId,
      response: { action: "object", reason: "The scope needs correction." },
    });
    const beforeItems = structuredClone(harness.proposal.items);

    await expect(
      harness.service.resolve({
        actor: { userId: harness.managerId, active: true },
        correlationId: crypto.randomUUID(),
        proposalId: harness.proposalId,
        resolution: {
          decision: "request_revision",
          reason: "Revise through a new owner-reviewed proposal.",
        },
      }),
    ).resolves.toMatchObject({ state: "superseded", version: 4 });
    expect(harness.getManagerResolution()).toMatchObject({
      decision: "request_revision",
    });
    expect(harness.proposal.items).toEqual(beforeItems);
    expect(harness.itemUpdateMany).not.toHaveBeenCalled();
  });
});
