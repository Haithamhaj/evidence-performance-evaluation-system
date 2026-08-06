import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ResearchSourceReviewPersistence } from "./source-review-persistence.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-08-06T09:00:00.000Z");
const ids: Record<"owner" | "other" | "project" | "run" | "routeConfig", string> = {
  owner: crypto.randomUUID(),
  other: crypto.randomUUID(),
  project: crypto.randomUUID(),
  run: crypto.randomUUID(),
  routeConfig: crypto.randomUUID(),
};

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `research-review-${suffix}`, name: "Research Review" },
  });
  const department = await client.department.create({
    data: {
      key: `research-review-department-${suffix}`,
      name: "Research Review",
      organizationId: organization.id,
    },
  });
  await client.user.createMany({
    data: [
      {
        id: ids.owner,
        email: `research-review-owner-${suffix}@example.invalid`,
        displayName: "Research owner",
      },
      {
        id: ids.other,
        email: `research-review-other-${suffix}@example.invalid`,
        displayName: "Other employee",
      },
    ],
  });
  await client.authorizationScope.create({
    data: {
      id: ids.project,
      key: `research-review-project-${suffix}`,
      scopeType: "project",
      departmentId: department.id,
    },
  });
  await client.project.create({
    data: {
      id: ids.project,
      organizationId: organization.id,
      departmentId: department.id,
      authorizationScopeId: ids.project,
      name: "Research source review",
      description: "Verify the private review workflow.",
      status: "active",
      createdById: ids.owner,
    },
  });
  const trace = await seedAiTrace(ids.owner, ids.project);
  ids.run = trace.runId;
  ids.routeConfig = trace.routeConfigId;
});

afterAll(async () => client.$disconnect());

function pendingInput(idempotencyKey = crypto.randomUUID()) {
  return {
    id: crypto.randomUUID(),
    ownerId: ids.owner,
    scope: { projectId: ids.project, workstreamId: null, workItemId: null },
    idempotencyKey,
    sourceKind: "URL" as const,
    sealedSource: {
      ciphertext: "ciphertext:original-url",
      keyVersion: "test-key-v1",
      sourceFingerprint: "a".repeat(64),
    },
    documentVersionId: null,
    createdAt: now,
  };
}

describe("ResearchSourceReviewPersistence", () => {
  it("replays the same idempotent start and rejects a changed source identity", async () => {
    const persistence = new ResearchSourceReviewPersistence(client);
    const command = pendingInput();
    const first = await persistence.createOrReplayPending(command);
    const replay = await persistence.createOrReplayPending({ ...command, id: crypto.randomUUID() });

    expect(replay.id).toBe(first.id);
    await expect(
      persistence.createOrReplayPending({
        ...command,
        id: crypto.randomUUID(),
        sealedSource: { ...command.sealedSource, sourceFingerprint: "b".repeat(64) },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_REVIEW_REPLAY_MISMATCH" });
  });

  it("reclaims only a stale pending owner and fences the late original owner", async () => {
    const persistence = new ResearchSourceReviewPersistence(client);
    const idempotencyKey = crypto.randomUUID();
    const original = pendingInput(idempotencyKey);
    const first = await persistence.createOrReplayPending({
      ...original,
      createdAt: new Date("2026-08-06T08:00:00.000Z"),
      claimedAt: new Date("2026-08-06T08:00:00.000Z"),
      staleBefore: new Date("2026-08-06T07:59:00.000Z"),
    });
    const freshReplay = await persistence.createOrReplayPending({
      ...original,
      id: crypto.randomUUID(),
      createdAt: new Date("2026-08-06T08:00:30.000Z"),
      claimedAt: new Date("2026-08-06T08:00:30.000Z"),
      staleBefore: new Date("2026-08-06T07:59:30.000Z"),
    });
    const reclaimed = await persistence.createOrReplayPending({
      ...original,
      id: crypto.randomUUID(),
      createdAt: new Date("2026-08-06T08:02:00.000Z"),
      claimedAt: new Date("2026-08-06T08:02:00.000Z"),
      staleBefore: new Date("2026-08-06T08:01:00.000Z"),
    });

    expect((first as unknown as { processingClaimed?: boolean }).processingClaimed).toBe(true);
    expect((freshReplay as unknown as { processingClaimed?: boolean }).processingClaimed).toBe(
      false,
    );
    expect(reclaimed).toMatchObject({ processingClaimed: true, version: 2 });
    await expect(
      persistence.appendBlocked({
        reviewId: first.id,
        ownerId: ids.owner,
        expectedVersion: 1,
        retrievalState: "BLOCKED",
        retrievalReason: "LATE_OWNER",
        displayUrl: null,
        contentFingerprint: null,
        projectContextFingerprint: "f".repeat(64),
        sealedRetrievedContent: null,
        actorId: ids.owner,
        createdAt: now,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_REVIEW_VERSION_CONFLICT" });
  });

  it("renews only the current pending owner at the expected fenced version", async () => {
    const persistence = new ResearchSourceReviewPersistence(client);
    const created = await persistence.createOrReplayPending(pendingInput());
    const renewedAt = new Date("2026-08-06T09:00:10.000Z");

    const renewedVersion = await persistence.renewPendingLease({
      reviewId: created.id,
      ownerId: ids.owner,
      expectedVersion: created.version,
      renewedAt,
    });

    expect(renewedVersion).toBe(created.version + 1);
    await expect(
      persistence.renewPendingLease({
        reviewId: created.id,
        ownerId: ids.owner,
        expectedVersion: created.version,
        renewedAt,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_REVIEW_VERSION_CONFLICT" });
    await expect(
      persistence.renewPendingLease({
        reviewId: created.id,
        ownerId: ids.other,
        expectedVersion: renewedVersion,
        renewedAt,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_REVIEW_VERSION_CONFLICT" });

    await persistence.appendBlocked({
      reviewId: created.id,
      ownerId: ids.owner,
      expectedVersion: renewedVersion,
      retrievalState: "BLOCKED",
      retrievalReason: "TEST_TERMINAL_STATE",
      displayUrl: null,
      contentFingerprint: null,
      projectContextFingerprint: "f".repeat(64),
      sealedRetrievedContent: null,
      actorId: ids.owner,
      createdAt: renewedAt,
    });
    await expect(
      persistence.renewPendingLease({
        reviewId: created.id,
        ownerId: ids.owner,
        expectedVersion: renewedVersion + 1,
        renewedAt,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_REVIEW_VERSION_CONFLICT" });
  });

  it("stores only ciphertext for source, retrieved text, AI output, and proposal content", async () => {
    const persistence = new ResearchSourceReviewPersistence(client);
    const created = await persistence.createOrReplayPending(pendingInput());
    await persistence.appendReviewed({
      reviewId: created.id,
      ownerId: ids.owner,
      expectedVersion: 1,
      state: "READY_FOR_REVIEW",
      retrievalState: "RETRIEVED",
      retrievalReason: null,
      displayUrl: "https://example.com/paper",
      contentFingerprint: "c".repeat(64),
      projectContextFingerprint: "d".repeat(64),
      sealedRetrievedContent: JSON.stringify({
        ciphertext: "ciphertext:retrieved-text",
        keyVersion: "test-key-v1",
      }),
      sealedOutput: JSON.stringify({
        ciphertext: "ciphertext:ai-output",
        keyVersion: "test-key-v1",
      }),
      citationIdentities: [`retrieval:${"c".repeat(64)}`],
      schemaVersion: "research-source-review-output.v1",
      promptVersion: "research-source-review-prompt.v1",
      routeTrace: {
        aiRunId: ids.run,
        routeKey: "research.source-review.v1",
        routeConfigId: ids.routeConfig,
        routeConfigVersion: 1,
      },
      proposals: [
        {
          id: crypto.randomUUID(),
          kind: "WORK_ITEM",
          originRevision: 1,
          sourceReferences: [`retrieval:${"c".repeat(64)}`],
          sealedContent: {
            ciphertext: "ciphertext:proposal",
            keyVersion: "test-key-v1",
          },
        },
      ],
      actorId: ids.owner,
      createdAt: now,
    });

    const row = await client.researchSourceReview.findUniqueOrThrow({
      where: { id: created.id },
      include: { revisions: true, proposals: true },
    });
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain("https://example.com/private-paper");
    expect(serialized).not.toContain("retrieved source plaintext");
    expect(serialized).not.toContain("AI private summary");
    expect(serialized).not.toContain("Private Work Item proposal");
    expect(row.revisions).toHaveLength(1);
    expect(row.revisions[0]?.outputFragments).toBeNull();
    expect(row.proposals[0]?.title).toBe("Private WORK_ITEM proposal");
  });

  it("keeps reads owner-only and confirms named proposals without creating Work Items", async () => {
    const persistence = new ResearchSourceReviewPersistence(client);
    const created = await persistence.createOrReplayPending(pendingInput());
    const selectedId = crypto.randomUUID();
    const rejectedId = crypto.randomUUID();
    await persistence.appendReviewed({
      reviewId: created.id,
      ownerId: ids.owner,
      expectedVersion: 1,
      state: "READY_FOR_REVIEW",
      retrievalState: "RETRIEVED",
      retrievalReason: null,
      displayUrl: "https://example.com/paper",
      contentFingerprint: "e".repeat(64),
      projectContextFingerprint: "f".repeat(64),
      sealedRetrievedContent: JSON.stringify({ ciphertext: "text", keyVersion: "v1" }),
      sealedOutput: JSON.stringify({ ciphertext: "output", keyVersion: "v1" }),
      citationIdentities: [`retrieval:${"e".repeat(64)}`],
      schemaVersion: "research-source-review-output.v1",
      promptVersion: "research-source-review-prompt.v1",
      routeTrace: {
        aiRunId: ids.run,
        routeKey: "research.source-review.v1",
        routeConfigId: ids.routeConfig,
        routeConfigVersion: 1,
      },
      proposals: [selectedId, rejectedId].map((id) => ({
        id,
        kind: "RESEARCH" as const,
        originRevision: 1,
        sourceReferences: [`retrieval:${"e".repeat(64)}`],
        sealedContent: { ciphertext: `proposal:${id}`, keyVersion: "v1" },
      })),
      actorId: ids.owner,
      createdAt: now,
    });

    await expect(
      persistence.loadOwned({ reviewId: created.id, ownerId: ids.other }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_REVIEW_FORBIDDEN" });
    const beforeWorkItems = await client.workItem.count({ where: { projectId: ids.project } });
    const confirmed = await persistence.confirm({
      reviewId: created.id,
      ownerId: ids.owner,
      expectedVersion: 2,
      proposalIds: [selectedId],
      reason: "Use only the named Research proposal.",
      actorId: ids.owner,
      sealedDisposition: JSON.stringify({ ciphertext: "confirm-reason", keyVersion: "v1" }),
      createdAt: now,
    });
    const replay = await persistence.confirm({
      reviewId: created.id,
      ownerId: ids.owner,
      expectedVersion: 2,
      proposalIds: [selectedId],
      reason: "Use only the named Research proposal.",
      actorId: ids.owner,
      sealedDisposition: JSON.stringify({ ciphertext: "confirm-reason", keyVersion: "v1" }),
      createdAt: now,
    });
    const proposals = await client.researchProposal.findMany({
      where: { reviewId: created.id },
      orderBy: { id: "asc" },
    });

    expect(confirmed.state).toBe("CONFIRMED");
    expect(replay.version).toBe(confirmed.version);
    expect(proposals.find(({ id }) => id === selectedId)?.state).toBe("CONFIRMED");
    expect(proposals.find(({ id }) => id === rejectedId)?.state).toBe("DISMISSED");
    expect(await client.workItem.count({ where: { projectId: ids.project } })).toBe(
      beforeWorkItems,
    );
  });
});

async function seedAiTrace(ownerId: string, scopeId: string) {
  const suffix = crypto.randomUUID();
  const routeKey = `research.source-review.fixture.${suffix}`;
  const route = await client.aiRoute.create({
    data: { routeKey, level: "project", scopeId },
  });
  const routeConfig = await client.aiRouteConfig.create({
    data: { routeId: route.id, version: 1, reason: "Source-review fixture", createdById: ownerId },
  });
  const provider = await client.aiProviderConfig.create({
    data: {
      providerKey: `research-source-review-${suffix}`,
      version: 1,
      adapterKey: "fixture",
      modelKey: "fixture-model",
      locality: "external",
      endpoint: "https://provider.example.invalid/v1/chat/completions",
      endpointProtocol: "https",
      endpointHost: "provider.example.invalid",
      reason: "Source-review fixture",
      createdById: ownerId,
    },
  });
  const routeProvider = await client.aiRouteConfigProvider.create({
    data: {
      routeConfigId: routeConfig.id,
      position: 0,
      providerConfigId: provider.id,
      providerConfigVersion: provider.version,
    },
  });
  const artifact = await client.aiOutputSchemaArtifact.create({
    data: {
      routeKey,
      version: "research-source-review-output.v1",
      schemaHash: "a".repeat(64),
      schemaArtifact: {},
      reason: "Source-review fixture",
      expectedBehavior: "Supplies governed source-review provenance.",
      evaluationEvidenceReferences: [`ai-eval:${crypto.randomUUID()}`],
      humanApprovalPolicy: "feature_defined",
      createdById: ownerId,
    },
  });
  const run = await client.aiRun.create({
    data: {
      routeKey,
      routeId: route.id,
      routeConfigId: routeConfig.id,
      routeConfigVersion: routeConfig.version,
      routeLevel: "project",
      scopeId,
      routeConfigProviderId: routeProvider.id,
      providerConfigId: provider.id,
      providerConfigVersion: provider.version,
      classification: "confidential",
      inputReference: `project:${scopeId}`,
      inputSchemaVersion: "research-source-review-input.v1",
      outputSchemaVersion: artifact.version,
      outputSchemaArtifactId: artifact.id,
      outputSchemaHash: artifact.schemaHash,
      promptTemplateVersion: "research-source-review-prompt.v1",
      sourceReferences: [`project:${scopeId}`],
      outputReference: `research-source-review:${crypto.randomUUID()}`,
      startedAt: now,
      completedAt: now,
      latencyMs: 0,
      state: "succeeded",
      fallbackChain: [],
      humanApprovalState: "pending",
      correlationId: crypto.randomUUID(),
      validationIssueCodes: [],
    },
  });
  return { runId: run.id, routeConfigId: routeConfig.id };
}
