import { describe, expect, it, vi } from "vitest";

import { ProgressContractService } from "./progress-contract-service.js";

const now = new Date("2026-07-18T12:00:00.000Z");

function harness() {
  const actorId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const documentVersionId = crypto.randomUUID();
  const components = [
    {
      id: crypto.randomUUID(),
      kind: "milestone" as const,
      name: "Pilot ready",
      description: "The pilot acceptance flow is ready.",
      weight: 100,
      baseline: null,
      target: null,
      unit: null,
      direction: null,
      acceptanceConditions: ["Product owner accepted the pilot"],
      requiredEvidence: ["Acceptance record"],
      confirmationMode: "human_confirmed" as const,
    },
  ];
  let row: any;
  const contract = {
    create: vi.fn(async ({ data }: any) => {
      row = {
        ...data,
        id: data.id,
        version: 1,
        state: "draft",
        approverId: null,
        approvedAt: null,
        previousContractId: data.previousContractId ?? null,
        components: data.components.create.map((component: any) => ({ ...component })),
      };
      return row;
    }),
    findUnique: vi.fn(async () => row),
    update: vi.fn(async ({ data }: any) => {
      row = {
        ...row,
        ...data,
        version:
          typeof data.version === "object" ? row.version + data.version.increment : data.version,
      };
      return row;
    }),
    findFirst: vi.fn(async (): Promise<any> => null),
  };
  const transaction: any = {
    $queryRaw: vi.fn(async () => []),
    progressContract: contract,
    progressContractTransition: { create: vi.fn(async () => ({})) },
  };
  const database = {
    $transaction: vi.fn(async (operation: (tx: any) => Promise<unknown>) => operation(transaction)),
  };
  const auditWriter = { append: vi.fn(async () => ({ id: crypto.randomUUID() })) };
  const getApprovedSourceIn = vi.fn<() => Promise<any>>(async () => ({
    documentId,
    documentVersionId,
    documentVersion: 2,
    readinessCheckId: crypto.randomUUID(),
    projectId,
    workstreamId: null,
    sourceReferences: [`document-version:${documentVersionId}`],
  }));
  const documentReader = { getApprovedSourceIn };
  const identityReader = {
    snapshotIn: vi.fn(async () => ({
      kind: "project",
      resourceId: projectId,
      projectId,
      organizationId: crypto.randomUUID(),
      departmentId: crypto.randomUUID(),
      primaryOwnerId: actorId,
      contributorIds: [],
    })),
  };
  const githubSourceReader = {
    getVerifiedSource: vi.fn<() => Promise<any>>(async () => null),
  };
  const service = new ProgressContractService(
    database as never,
    auditWriter as never,
    documentReader as never,
    identityReader as never,
    () => now,
    githubSourceReader as never,
  );
  return {
    actorId,
    projectId,
    documentId,
    documentVersionId,
    components,
    service,
    transaction,
    auditWriter,
    documentReader,
    githubSourceReader,
    get row() {
      return row;
    },
  };
}

function proposalInput(context: ReturnType<typeof harness>) {
  return {
    actor: { userId: context.actorId, active: true },
    correlationId: crypto.randomUUID(),
    reason: "Derived from the approved project document.",
    draft: {
      scopeKind: "project",
      projectId: context.projectId,
      workstreamId: null,
      sourceDocumentId: context.documentId,
      sourceDocumentVersionId: context.documentVersionId,
      sourceDocumentVersion: 2,
      calculationKind: "weighted",
      calculationSchemaVersion: "1.0.0",
      effectiveAt: now.toISOString(),
      components: context.components,
    },
  } as const;
}

describe("ProgressContractService", () => {
  it("preserves exact document lineage and activates through the approved lifecycle", async () => {
    const context = harness();
    const draft = await context.service.propose(proposalInput(context));
    expect(draft).toMatchObject({
      state: "draft",
      version: 1,
      sourceDocumentId: context.documentId,
      sourceDocumentVersionId: context.documentVersionId,
      sourceDocumentVersion: 2,
      ownerId: context.actorId,
    });

    const pending = await context.service.submitForApproval({
      actor: { userId: context.actorId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: context.projectId,
      contractId: draft.id,
      input: { expectedVersion: 1, reason: "Ready for owner approval." },
    });
    expect(pending).toMatchObject({ state: "pending_approval", version: 2 });

    const active = await context.service.approve({
      actor: { userId: context.actorId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: context.projectId,
      contractId: draft.id,
      input: { expectedVersion: 2, reason: "Approved measurable progress rules." },
    });
    expect(active).toMatchObject({
      contractVersion: 1,
      state: "active",
      version: 3,
      approverId: context.actorId,
      approvedAt: now.toISOString(),
    });
    expect(context.transaction.progressContractTransition.create).toHaveBeenCalledTimes(2);
    expect(context.auditWriter.append).toHaveBeenCalledTimes(3);
  });

  it("assigns a new immutable contract version to a prospective successor", async () => {
    const context = harness();
    const first = await context.service.propose(proposalInput(context));
    const pending = await context.service.submitForApproval({
      actor: { userId: context.actorId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: context.projectId,
      contractId: first.id,
      input: { expectedVersion: 1, reason: "Review requested." },
    });
    await context.service.approve({
      actor: { userId: context.actorId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: context.projectId,
      contractId: first.id,
      input: { expectedVersion: pending.version, reason: "First contract approved." },
    });
    context.transaction.progressContract.findFirst
      .mockResolvedValueOnce({ id: first.id, contractVersion: 1 })
      .mockResolvedValueOnce({ contractVersion: 1 });

    const successor = await context.service.propose(proposalInput(context));

    expect(successor).toMatchObject({
      contractVersion: 2,
      previousContractId: first.id,
      version: 1,
    });
  });

  it("rejects a proposal when the exact source version is no longer approved", async () => {
    const context = harness();
    context.documentReader.getApprovedSourceIn.mockResolvedValueOnce(null);

    await expect(context.service.propose(proposalInput(context))).rejects.toMatchObject({
      code: "PROGRESS_CONTRACT_SOURCE_INVALID",
    });
    expect(context.transaction.progressContract.create).not.toHaveBeenCalled();
  });

  it("rejects instead of changing the calculation rules in place", async () => {
    const context = harness();
    const draft = await context.service.propose(proposalInput(context));
    const pending = await context.service.submitForApproval({
      actor: { userId: context.actorId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: context.projectId,
      contractId: draft.id,
      input: { expectedVersion: 1, reason: "Review requested." },
    });
    const rejected = await context.service.reject({
      actor: { userId: context.actorId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: context.projectId,
      contractId: draft.id,
      input: { expectedVersion: pending.version, reason: "Source needs revision." },
    });

    expect(rejected).toMatchObject({ state: "rejected", version: 3 });
    expect(rejected.components).toEqual(draft.components);
  });

  it("rejects a decision routed through a different Project", async () => {
    const context = harness();
    const draft = await context.service.propose(proposalInput(context));

    await expect(
      context.service.submitForApproval({
        actor: { userId: context.actorId, active: true },
        correlationId: crypto.randomUUID(),
        projectId: crypto.randomUUID(),
        contractId: draft.id,
        input: { expectedVersion: 1, reason: "Cross-Project attempt." },
      }),
    ).rejects.toMatchObject({ code: "SCOPE_MISMATCH" });
    expect(context.transaction.progressContractTransition.create).not.toHaveBeenCalled();
  });

  it("uses only persisted active-contract GitHub rules and queues ambiguous source events for Project-owner review", async () => {
    const context = harness();
    const sourceEventId = crypto.randomUUID();
    const bindingId = crypto.randomUUID();
    context.githubSourceReader.getVerifiedSource.mockResolvedValueOnce({
      sourceEventId,
      bindingId,
      projectId: context.projectId,
      installationId: crypto.randomUUID(),
      repositoryId: "repository-42",
      sourceId: "PR_42",
      occurredAt: now,
      governedFacts: [{ kind: "pull_request", state: "merged" }],
    });
    context.transaction.progressContract.findFirst.mockResolvedValueOnce({
      id: crypto.randomUUID(),
      contractVersion: 3,
      state: "active",
      ownerId: context.actorId,
    });
    context.transaction.gitHubContractRule = {
      findMany: vi.fn(async () =>
        ["one", "two"].map((id) => ({
          id,
          componentId: crypto.randomUUID(),
          sourceId: "PR_42",
          eventKind: "pull_request",
          acceptanceState: "merged",
        })),
      ),
    };
    context.transaction.gitHubProgressReview = {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: crypto.randomUUID() })),
    };
    context.transaction.gitHubProgressReviewCandidate = {
      createMany: vi.fn(async () => ({ count: 2 })),
    };

    await expect(context.service.evaluateGitHubSource({ sourceEventId })).resolves.toMatchObject({
      state: "owner_review_required",
      sourceEventId,
      projectId: context.projectId,
    });
    expect(context.transaction.gitHubProgressReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceEventId,
          disposition: "ambiguous",
        }),
      }),
    );
    expect(context.transaction.gitHubProgressReviewCandidate.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ ruleId: "one" }),
        expect.objectContaining({ ruleId: "two" }),
      ]),
    });
    expect(context.githubSourceReader.getVerifiedSource).toHaveBeenCalledWith({ sourceEventId });
  });
});
