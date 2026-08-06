import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ResearchSourceReviewPersistence } from "./source-review-persistence.js";
import { ResearchSourceReviewService } from "./source-review-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const at = new Date("2026-08-06T11:00:00.000Z");
const ids: Record<
  "owner" | "other" | "project" | "workstream" | "workItem" | "run" | "routeConfig",
  string
> = {
  owner: crypto.randomUUID(),
  other: crypto.randomUUID(),
  project: crypto.randomUUID(),
  workstream: crypto.randomUUID(),
  workItem: crypto.randomUUID(),
  run: crypto.randomUUID(),
  routeConfig: crypto.randomUUID(),
};

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `research-review-service-${suffix}`, name: "Research Review Service" },
  });
  const department = await client.department.create({
    data: {
      key: `research-review-service-department-${suffix}`,
      name: "Research Review Service",
      organizationId: organization.id,
    },
  });
  await client.user.createMany({
    data: [
      {
        id: ids.owner,
        email: `research-review-service-owner-${suffix}@example.invalid`,
        displayName: "Research owner",
      },
      {
        id: ids.other,
        email: `research-review-service-other-${suffix}@example.invalid`,
        displayName: "Other employee",
      },
    ],
  });
  await client.authorizationScope.createMany({
    data: [
      {
        id: ids.project,
        key: `research-review-service-project-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
      {
        id: ids.workstream,
        key: `research-review-service-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId: department.id,
      },
    ],
  });
  await client.project.create({
    data: {
      id: ids.project,
      organizationId: organization.id,
      departmentId: department.id,
      authorizationScopeId: ids.project,
      name: "Research review service",
      description: "Exercise the private workflow.",
      status: "active",
      createdById: ids.owner,
    },
  });
  await client.workstream.create({
    data: {
      id: ids.workstream,
      projectId: ids.project,
      authorizationScopeId: ids.workstream,
      name: "Source review",
      description: "Review explicit sources.",
      status: "active",
      createdById: ids.owner,
    },
  });
  await client.workItem.create({
    data: {
      id: ids.workItem,
      projectId: ids.project,
      workstreamId: ids.workstream,
      title: "Review source",
      description: "Review a paper safely.",
      requirements: [],
      acceptanceConditions: [],
      assigneeId: ids.owner,
      createdById: ids.owner,
    },
  });
  const trace = await seedAiTrace(ids.owner, ids.project);
  ids.run = trace.runId;
  ids.routeConfig = trace.routeConfigId;
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
      startedAt: at,
      completedAt: at,
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

afterAll(async () => client.$disconnect());

const scope = {
  projectId: ids.project,
  workstreamId: ids.workstream,
  workItemId: ids.workItem,
};

const aiOutput = {
  schemaVersion: "research-source-review-output.v1" as const,
  summary: "The retrieved source describes a bounded comparison.",
  relevance: "It may inform the Project after employee review.",
  citations: [{ sourceReference: `retrieval:${"a".repeat(64)}`, locator: "section-1" }],
  benefits: ["May provide a comparison candidate."],
  risks: ["The source conditions differ."],
  mismatches: ["No Project result is supplied."],
  uncertainties: ["Project benefit remains unverified."],
  disposition: "PREPARE_WORK_ITEM" as const,
  proposals: [
    {
      id: crypto.randomUUID(),
      kind: "WORK_ITEM" as const,
      title: "Compare the source method",
      rationale: "A controlled comparison may reduce uncertainty.",
      sourceReferences: [`retrieval:${"a".repeat(64)}`],
      description: "Run a bounded comparison using the Project dataset.",
      proposedAssigneeId: ids.owner,
      acceptanceConditions: ["Record baseline and result."],
    },
  ],
};

function protector() {
  return {
    seal: vi.fn(async (value: string) => ({
      ciphertext: `sealed:${encodeURIComponent(value)}`,
      keyVersion: "test-v1",
    })),
    open: vi.fn(async ({ ciphertext }: { ciphertext: string; keyVersion: string }) =>
      decodeURIComponent(ciphertext.slice("sealed:".length)),
    ),
  };
}

function harness(input?: { deny?: boolean; retrievalState?: "RETRIEVED" | "PARTIAL" | "BLOCKED" }) {
  const privateProtector = protector();
  const callOrder: string[] = [];
  const authorizer = {
    authorize: vi.fn(
      async ({
        actor,
        scope: authorizedScope,
      }: {
        actor: { userId: string };
        scope: import("@evaluation/contracts").ResearchScope;
      }) => {
        callOrder.push("authorize");
        if (input?.deny || actor.userId !== ids.owner)
          throw Object.assign(new Error("forbidden"), { code: "RESEARCH_SCOPE_FORBIDDEN" });
        expect(authorizedScope).toEqual(scope);
        return { actorId: actor.userId };
      },
    ),
  };
  const retriever = {
    retrieve: vi.fn(async () => {
      callOrder.push("retrieve");
      const state = input?.retrievalState ?? "RETRIEVED";
      return {
        state,
        sourceKind: "PAPER" as const,
        sourceLabel: "ABSTRACT_PAGE" as const,
        requestedUrl: "https://example.com/paper?private=1",
        resolvedUrl: "https://example.com/paper?private=1",
        retrievedAt: at.toISOString(),
        title: "Paper",
        mimeType: "text/plain",
        byteSize: state === "BLOCKED" ? 0 : 64,
        contentFingerprintSha256: state === "BLOCKED" ? null : "a".repeat(64),
        text: state === "BLOCKED" ? null : "retrieved source plaintext",
        reason: state === "BLOCKED" ? "SOURCE_UNAVAILABLE" : null,
        recoveryOptions: [],
        redirectCount: 0,
      };
    }),
  };
  const snapshot = {
    readAuthorizedSnapshot: vi.fn(async () => ({
      schemaVersion: "research-project-context.v1" as const,
      projectId: ids.project,
      projectName: "Research review service",
      projectVersion: 1,
      projectContentIdentitySha256: "b".repeat(64),
      projectSourceReference: `project:${ids.project}`,
      projectContentIdentityReference: `project-version:${"b".repeat(64)}`,
      generatedAt: at.toISOString(),
      fingerprintSha256: "c".repeat(64),
      sourceReferences: [`project:${ids.project}`],
      objective: "Review sources safely.",
      constraints: [],
      deliverables: [],
      operationalKpis: [],
      workstreams: [],
      workItems: [],
      decisions: [],
    })),
  };
  const assistant = {
    reviewSource: vi.fn(
      async (
        _command: unknown,
        persist: (transaction: unknown, output: typeof aiOutput) => Promise<unknown>,
      ) => {
        callOrder.push("ai");
        const generated = {
          ...aiOutput,
          proposals: aiOutput.proposals.map((proposal) => ({
            ...proposal,
            id: crypto.randomUUID(),
          })),
        };
        await persist(undefined, generated);
        return {
          output: generated,
          outputReference: "research-source-review:pending",
          promptVersion: "research-source-review-prompt.v1",
          requiresHumanApproval: true as const,
          routeTrace: {
            aiRunId: ids.run,
            routeKey: "research.source-review.v1",
            routeConfigId: ids.routeConfig,
            routeConfigVersion: 1,
          },
        };
      },
    ),
  };
  const service = new ResearchSourceReviewService({
    persistence: new ResearchSourceReviewPersistence(client),
    authorizer,
    projectContexts: snapshot,
    retriever,
    connectedSources: {
      readPrivateSourceIntake: vi.fn(async () => ({
        sourceItemId: crypto.randomUUID(),
        provider: "GOOGLE_GMAIL" as const,
        occurredAt: at.toISOString(),
        title: "Private source title",
        summary: "Private source summary",
        sourceUrl: "https://example.com/paper?private=1",
        sourceReference: `connected-source-item:${crypto.randomUUID()}`,
      })),
    },
    documents: {
      readApprovedVersion: vi.fn(async () => ({
        projectId: ids.project,
        documentId: crypto.randomUUID(),
        documentVersionId: crypto.randomUUID(),
        documentVersion: 1,
        sourceChecksumSha256: "a".repeat(64),
        sourceReferences: [`document-version:${"d".repeat(64)}`],
        extractedText: "approved immutable document text",
      })),
    },
    assistant,
    protector: privateProtector,
    systemId: crypto.randomUUID(),
    clock: () => new Date(at),
    idFactory: () => crypto.randomUUID(),
  });
  return { service, authorizer, retriever, snapshot, assistant, privateProtector, callOrder };
}

describe("ResearchSourceReviewService", () => {
  it("replays an identical start without retrieving or running AI again", async () => {
    const fixture = harness();
    const command = {
      actor: { userId: ids.owner, active: true },
      scope,
      idempotencyKey: crypto.randomUUID(),
      source: { kind: "URL" as const, url: "https://example.com/paper?private=1" },
      correlationId: crypto.randomUUID(),
    };

    const first = await fixture.service.start(command);
    const replay = await fixture.service.start({ ...command, correlationId: crypto.randomUUID() });

    expect(replay.id).toBe(first.id);
    expect(replay.version).toBe(first.version);
    expect(fixture.retriever.retrieve).toHaveBeenCalledTimes(1);
    expect(fixture.assistant.reviewSource).toHaveBeenCalledTimes(1);
  });

  it("reauthorizes the exact scope before retrieval and stores no official Work Item", async () => {
    const fixture = harness();
    const before = await client.workItem.count({ where: { projectId: ids.project } });
    const result = await fixture.service.start({
      actor: { userId: ids.owner, active: true },
      scope,
      idempotencyKey: crypto.randomUUID(),
      source: { kind: "URL", url: "https://example.com/paper?private=1" },
      correlationId: crypto.randomUUID(),
    });

    expect(result.state).toBe("READY_FOR_REVIEW");
    expect(result.output?.proposals).toHaveLength(1);
    expect(fixture.callOrder.indexOf("authorize")).toBeLessThan(
      fixture.callOrder.indexOf("retrieve"),
    );
    expect(await client.workItem.count({ where: { projectId: ids.project } })).toBe(before);
  });

  it("returns a truthful blocked review without calling AI or inventing a claim", async () => {
    const fixture = harness({ retrievalState: "BLOCKED" });
    const result = await fixture.service.start({
      actor: { userId: ids.owner, active: true },
      scope,
      idempotencyKey: crypto.randomUUID(),
      source: { kind: "URL", url: "https://example.com/unavailable.pdf" },
      correlationId: crypto.randomUUID(),
    });

    expect(result).toMatchObject({ state: "BLOCKED", output: null });
    expect(result.recoveryOptions.map(({ kind }) => kind)).toEqual([
      "UPLOAD_DOCUMENT",
      "ADD_MANUAL_CITATION",
      "TRY_AGAIN",
    ]);
    expect(fixture.assistant.reviewSource).not.toHaveBeenCalled();
  });

  it("reauthorizes before owner-only decrypt and never opens for another employee", async () => {
    const fixture = harness();
    const created = await fixture.service.start({
      actor: { userId: ids.owner, active: true },
      scope,
      idempotencyKey: crypto.randomUUID(),
      source: { kind: "URL", url: "https://example.com/paper" },
      correlationId: crypto.randomUUID(),
    });
    fixture.privateProtector.open.mockClear();

    await expect(
      fixture.service.getPrivate({
        actor: { userId: ids.other, active: true },
        reviewId: created.id,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_REVIEW_FORBIDDEN" });
    expect(fixture.privateProtector.open).not.toHaveBeenCalled();
  });

  it("does not decrypt an owner's draft after exact Project access is revoked", async () => {
    const fixture = harness();
    const created = await fixture.service.start({
      actor: { userId: ids.owner, active: true },
      scope,
      idempotencyKey: crypto.randomUUID(),
      source: { kind: "URL", url: "https://example.com/paper" },
      correlationId: crypto.randomUUID(),
    });
    fixture.privateProtector.open.mockClear();
    fixture.authorizer.authorize.mockRejectedValueOnce(
      Object.assign(new Error("forbidden"), { code: "RESEARCH_SCOPE_FORBIDDEN" }),
    );

    await expect(
      fixture.service.getPrivate({
        actor: { userId: ids.owner, active: true },
        reviewId: created.id,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SCOPE_FORBIDDEN" });
    expect(fixture.privateProtector.open).not.toHaveBeenCalled();
  });

  it("confirms only named proposals after reauthorization and preserves rejected proposals", async () => {
    const fixture = harness();
    const created = await fixture.service.start({
      actor: { userId: ids.owner, active: true },
      scope,
      idempotencyKey: crypto.randomUUID(),
      source: { kind: "URL", url: "https://example.com/paper" },
      correlationId: crypto.randomUUID(),
    });
    const selectedId = created.output!.proposals[0]!.id;
    const beforeAuthorizations = fixture.authorizer.authorize.mock.calls.length;

    const confirmed = await fixture.service.confirmDisposition({
      actor: { userId: ids.owner, active: true },
      reviewId: created.id,
      correlationId: crypto.randomUUID(),
      input: {
        expectedVersion: created.version,
        disposition: "CONFIRM",
        reason: "Proceed with the named draft only.",
        proposalIds: [selectedId],
      },
    });

    expect(confirmed.state).toBe("CONFIRMED");
    expect(fixture.authorizer.authorize.mock.calls.length).toBeGreaterThan(beforeAuthorizations);
    await expect(
      fixture.service.confirmDisposition({
        actor: { userId: ids.owner, active: true },
        reviewId: created.id,
        correlationId: crypto.randomUUID(),
        input: {
          expectedVersion: created.version,
          disposition: "CONFIRM",
          reason: "Proceed with a foreign proposal.",
          proposalIds: [crypto.randomUUID()],
        },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_REVIEW_VERSION_CONFLICT" });
  });

  it("pins changed source and Project fingerprints in new immutable re-analysis revisions", async () => {
    const fixture = harness();
    const created = await fixture.service.start({
      actor: { userId: ids.owner, active: true },
      scope,
      idempotencyKey: crypto.randomUUID(),
      source: { kind: "URL", url: "https://example.com/paper" },
      correlationId: crypto.randomUUID(),
    });
    fixture.retriever.retrieve.mockResolvedValue({
      ...(await fixture.retriever.retrieve()),
      contentFingerprintSha256: "9".repeat(64),
      text: "changed retrieved source",
    });
    fixture.snapshot.readAuthorizedSnapshot.mockResolvedValue({
      ...(await fixture.snapshot.readAuthorizedSnapshot()),
      fingerprintSha256: "8".repeat(64),
    });

    const updated = await fixture.service.reanalyze({
      actor: { userId: ids.owner, active: true },
      reviewId: created.id,
      expectedVersion: created.version,
      correlationId: crypto.randomUUID(),
    });
    const rows = await client.researchSourceReviewRevision.findMany({
      where: { reviewId: created.id },
      orderBy: { revision: "asc" },
    });

    expect(updated.state).toBe("READY_FOR_REVIEW");
    expect(rows.map(({ retrievalState }) => retrievalState)).toEqual([
      "RETRIEVED",
      "STALE",
      "RETRIEVED",
    ]);
    expect(rows[0]?.contentFingerprint).toBe("a".repeat(64));
    expect(rows[2]).toMatchObject({
      contentFingerprint: "9".repeat(64),
      projectContextFingerprint: "8".repeat(64),
    });
  });
});
