import { describe, expect, it, vi } from "vitest";

import { RevisionService } from "./revision-service.js";

function createHarness() {
  const actorId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const organizationId = crypto.randomUUID();
  const departmentId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const beforeVersionId = crypto.randomUUID();
  const afterVersionId = crypto.randomUUID();
  const readinessCheckId = crypto.randomUUID();
  const comparisonReviewId = crypto.randomUUID();
  const proposalId = crypto.randomUUID();
  const setId = crypto.randomUUID();
  const promptArtifactId = crypto.randomUUID();
  const schemaArtifactId = crypto.randomUUID();
  const now = new Date("2026-07-17T12:01:00.000Z");
  const state = {
    material: true,
    latest: true,
    currentAfter: true,
    currentOwnerId: actorId,
    lifecycleState:
      "ready_for_criteria_generation" as import("@evaluation/contracts").ReadinessLifecycleState,
    lifecycle: [] as Record<string, unknown>[],
    requests: [] as Record<string, any>[],
    operations: [] as Record<string, unknown>[],
    outbox: [] as Record<string, unknown>[],
    audits: [] as Record<string, unknown>[],
  };
  const transaction = {
    $queryRaw: vi.fn(async () => []),
    dynamicCriteriaSet: {
      findFirst: vi.fn(async () => ({
        id: setId,
        kind: "project",
        projectId,
        workstreamId: null,
        sourceDocumentVersionId: beforeVersionId,
        proposalId,
        version: 1,
        effectiveTo: null,
      })),
    },
    dynamicCriteriaProposal: {
      findUnique: vi.fn(async () => ({ id: proposalId, state: "activated", version: 3 })),
    },
    analysisPromptArtifact: {
      findUnique: vi.fn(async () => ({
        id: promptArtifactId,
        version: "criteria-generation-prompt.v1",
        bodyHash: "prompt-hash",
      })),
    },
    aiOutputSchemaArtifact: {
      findUnique: vi.fn(async () => ({
        id: schemaArtifactId,
        version: "criteria-generation-output.v1",
        schemaHash: "schema-hash",
      })),
    },
    documentAnalysisRequest: {
      findUnique: vi.fn(
        async ({ where }: { where: { idempotencyKey: string } }) =>
          state.requests.find((row) => row.idempotencyKey === where.idempotencyKey) ?? null,
      ),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { createdAt: now, ...data };
        state.requests.push(row);
        return row;
      }),
    },
    operation: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.operations.push(data);
        return data;
      }),
    },
  };
  const database = {
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => {
      const backup = structuredClone(state);
      try {
        return await callback(transaction);
      } catch (error) {
        state.lifecycle.splice(0, state.lifecycle.length, ...backup.lifecycle);
        state.requests.splice(0, state.requests.length, ...backup.requests);
        state.operations.splice(0, state.operations.length, ...backup.operations);
        state.outbox.splice(0, state.outbox.length, ...backup.outbox);
        state.audits.splice(0, state.audits.length, ...backup.audits);
        state.lifecycleState = backup.lifecycleState;
        throw error;
      }
    }),
  };
  const documentPort = {
    lockReviewedMaterialRevisionIn: vi.fn(async () => ({
      comparisonReviewId,
      documentId,
      beforeDocumentVersionId: beforeVersionId,
      afterDocumentVersionId: afterVersionId,
      effectiveClassification: state.material ? "material_scope_or_goal_change" : "editorial",
      isLatestReview: state.latest,
      isCurrentAfterVersion: state.currentAfter,
    })),
    getPrerequisitesIn: vi.fn(async () => ({
      documentId,
      documentVersionId: afterVersionId,
      documentVersion: 2,
      readinessCheckId,
      lifecycleState: state.lifecycleState,
      projectId,
      workstreamId: null,
      sourceReferences: [`document-version:${afterVersionId}`],
    })),
    appendLifecycleTransition: vi.fn(async (_tx: unknown, input: Record<string, unknown>) => {
      state.lifecycle.push(input);
      state.lifecycleState =
        input.toState as import("@evaluation/contracts").ReadinessLifecycleState;
    }),
  };
  const reviewReader = {
    snapshotIn: vi.fn(async () => ({
      kind: "project" as const,
      resourceId: projectId,
      projectId,
      organizationId,
      departmentId,
      primaryOwnerId: state.currentOwnerId,
      contributorIds: [],
    })),
  };
  const audit = {
    append: vi.fn(async (_tx: unknown, input: Record<string, unknown>) => {
      state.audits.push(input);
      return input;
    }),
  };
  const outbox = {
    append: vi.fn(async (_tx: unknown, input: Record<string, unknown>) => {
      state.outbox.push(input);
      return input;
    }),
  };
  const service = new RevisionService(
    database as never,
    documentPort,
    reviewReader,
    audit as never,
    outbox,
    { now: () => now },
  );
  const command = {
    actor: { userId: actorId, active: true },
    correlationId: crypto.randomUUID(),
    kind: "project" as const,
    resourceId: projectId,
    idempotencyKey: "criteria-revision-1",
    revision: {
      comparisonReviewId,
      reason: "Regenerate criteria for the reviewed material change.",
    },
  };
  return { command, service, state, ids: { afterVersionId, readinessCheckId, proposalId, setId } };
}

describe("RevisionService", () => {
  it("queues a pinned replacement request and revision-required transition without live AI", async () => {
    const { command, ids, service, state } = createHarness();

    await expect(service.start(command)).resolves.toMatchObject({
      state: "queued",
      documentVersionIds: [ids.afterVersionId],
    });
    expect(state.requests).toEqual([
      expect.objectContaining({
        kind: "criteria_project",
        currentDocumentVersionId: ids.afterVersionId,
        pinnedReadinessCheckId: ids.readinessCheckId,
        pinnedProposalId: ids.proposalId,
      }),
    ]);
    expect(state.lifecycle).toEqual([
      expect.objectContaining({
        toState: "revision_required",
        comparisonReviewId: command.revision.comparisonReviewId,
      }),
    ]);
    expect(state.outbox).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
  });

  it("returns the original queued receipt on an authorized identical retry", async () => {
    const { command, service, state } = createHarness();

    const first = await service.start(command);
    await expect(service.start(command)).resolves.toEqual(first);
    expect(state.lifecycle).toHaveLength(1);
    expect(state.requests).toHaveLength(1);
    expect(state.operations).toHaveLength(1);
    expect(state.outbox).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
  });

  it("rejects a conflicting command that reuses the revision idempotency key", async () => {
    const { command, service } = createHarness();
    await service.start(command);

    await expect(
      service.start({
        ...command,
        revision: { ...command.revision, reason: "A different revision purpose." },
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("rechecks current ownership before returning an existing revision receipt", async () => {
    const { command, service, state } = createHarness();
    await service.start(command);
    state.currentOwnerId = crypto.randomUUID();

    await expect(service.start(command)).rejects.toMatchObject({
      code: "CRITERIA_REVISION_FORBIDDEN",
    });
  });

  it("rejects a non-material review atomically", async () => {
    const { command, service, state } = createHarness();
    state.material = false;
    await expect(service.start(command)).rejects.toBeDefined();
    expect(state.requests).toEqual([]);
    expect(state.lifecycle).toEqual([]);
    expect(state.outbox).toEqual([]);
  });

  it("rejects a superseded review atomically", async () => {
    const { command, service, state } = createHarness();
    state.latest = false;
    await expect(service.start(command)).rejects.toBeDefined();
    expect(state.requests).toEqual([]);
    expect(state.lifecycle).toEqual([]);
    expect(state.outbox).toEqual([]);
  });

  it("rejects a stale after-version atomically", async () => {
    const { command, service, state } = createHarness();
    state.currentAfter = false;
    await expect(service.start(command)).rejects.toBeDefined();
    expect(state.requests).toEqual([]);
    expect(state.lifecycle).toEqual([]);
    expect(state.outbox).toEqual([]);
  });
});
