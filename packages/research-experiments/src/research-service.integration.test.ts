import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ResearchQueryService } from "./research-query-service.js";
import { ResearchService } from "./research-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-08-06T10:00:00.000Z");
const ids = {
  owner: crypto.randomUUID(),
  successor: crypto.randomUUID(),
  contributor: crypto.randomUUID(),
  outsider: crypto.randomUUID(),
  project: crypto.randomUUID(),
  otherProject: crypto.randomUUID(),
  workstream: crypto.randomUUID(),
  foreignWorkstream: crypto.randomUUID(),
  workItem: crypto.randomUUID(),
  aiRun: "" as string,
  routeConfig: "" as string,
};

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `research-lifecycle-${suffix}`, name: "Research lifecycle" },
  });
  const department = await client.department.create({
    data: {
      key: `research-lifecycle-department-${suffix}`,
      name: "Research lifecycle",
      organizationId: organization.id,
    },
  });
  await client.user.createMany({
    data: Object.entries(ids)
      .filter(([key]) => ["owner", "successor", "contributor", "outsider"].includes(key))
      .map(([key, id]) => ({
        id,
        email: `research-${key}-${suffix}@example.invalid`,
        displayName: `Research ${key}`,
      })),
  });
  for (const projectId of [ids.project, ids.otherProject]) {
    await client.authorizationScope.create({
      data: {
        id: projectId,
        key: `research-project-${projectId}`,
        scopeType: "project",
        departmentId: department.id,
      },
    });
    await client.project.create({
      data: {
        id: projectId,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: projectId,
        name: `Research project ${projectId}`,
        description: "Research lifecycle fixture",
        status: "active",
        createdById: ids.owner,
      },
    });
  }
  await client.projectMember.createMany({
    data: [ids.owner, ids.successor, ids.contributor].map((employeeId) => ({
      projectId: ids.project,
      employeeId,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      endsAt: null,
      reason: "Research fixture",
      createdById: ids.owner,
    })),
  });
  for (const [workstreamId, projectId] of [
    [ids.workstream, ids.project],
    [ids.foreignWorkstream, ids.otherProject],
  ] as const) {
    await client.authorizationScope.create({
      data: {
        id: workstreamId,
        key: `research-workstream-${workstreamId}`,
        scopeType: "workstream",
        departmentId: department.id,
      },
    });
    await client.workstream.create({
      data: {
        id: workstreamId,
        projectId,
        authorizationScopeId: workstreamId,
        name: "Research stream",
        description: "Research stream",
        status: "active",
        createdById: ids.owner,
      },
    });
  }
  await client.workItem.create({
    data: {
      id: ids.workItem,
      projectId: ids.project,
      workstreamId: ids.workstream,
      title: "Research task",
      description: "Research task",
      requirements: [],
      acceptanceConditions: [],
      createdById: ids.owner,
    },
  });
  const trace = await seedAiTrace();
  ids.aiRun = trace.runId;
  ids.routeConfig = trace.routeConfigId;
});

afterAll(async () => client.$disconnect());

const authorizer = {
  authorize(input: any) {
    return authorizeUsing(client, input);
  },
  authorizeTransaction(transaction: any, input: any) {
    return authorizeUsing(transaction, input);
  },
};

const queries = new ResearchQueryService({ database: client, authorizer, clock: () => now });

async function authorizeUsing(database: any, { actor, scope, at }: any) {
  if (!actor.active) throw forbidden();
  const user = await database.user.findUnique({ where: { id: actor.userId } });
  const membership = await database.projectMember.findFirst({
    where: {
      projectId: scope.projectId,
      employeeId: actor.userId,
      startsAt: { lte: at },
      OR: [{ endsAt: null }, { endsAt: { gt: at } }],
    },
  });
  const workstream =
    scope.workstreamId === null
      ? null
      : await database.workstream.findFirst({
          where: { id: scope.workstreamId, projectId: scope.projectId },
        });
  const workItem =
    scope.workItemId === null
      ? null
      : await database.workItem.findFirst({
          where: { id: scope.workItemId, projectId: scope.projectId },
        });
  if (
    user?.active !== true ||
    membership === null ||
    (scope.workstreamId !== null && workstream === null) ||
    (scope.workItemId !== null && workItem === null) ||
    (workItem !== null &&
      scope.workstreamId !== null &&
      workItem.workstreamId !== scope.workstreamId)
  ) {
    throw forbidden();
  }
  return { projectId: scope.projectId };
}

const auditWriter = {
  append(transaction: any, input: any) {
    return transaction.auditEvent.create({
      data: {
        eventType: input.eventType,
        actorKind: input.actor.kind,
        actorId: input.actor.id,
        effectiveSubjectId: input.effectiveSubjectId,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        safeDiff: input.safeDiff,
        correlationId: input.correlationId,
        source: input.source,
      },
    });
  },
};

function service(overrides: Record<string, unknown> = {}) {
  return new ResearchService({
    database: client,
    authorizer,
    auditWriter: auditWriter as never,
    sourceValidator: {
      async validateConfirmedReview() {
        throw forbidden();
      },
      async validateApprovedDocument() {
        throw forbidden();
      },
    },
    clock: () => now,
    idFactory: () => crypto.randomUUID(),
    ...overrides,
  });
}

function actor(userId = ids.owner, active = true) {
  return { userId, active };
}

function content(question = "Will retrieval improve source grounding?") {
  return {
    problemStatement: "Source grounding needs validation.",
    context: "The project requires reproducible research.",
    question,
    objective: "Measure whether retrieval improves grounded findings.",
    hypothesis: { kind: "TESTABLE" as const, statement: "Retrieval improves grounding." },
    assumptions: ["Sources remain available."],
    constraints: ["No provider-specific calls."],
    knownUncertainty: ["External availability may vary."],
    alternatives: ["Manual citation review."],
    decisionQuestion: "Should retrieval be adopted?",
    sourceReferences: [],
    executionMode: "ai_assisted" as const,
  };
}

async function createDraft(
  scope = { projectId: ids.project, workstreamId: null, workItemId: null },
) {
  return service().create({
    actor: actor(),
    correlationId: crypto.randomUUID(),
    input: { ...content(), scope, idempotencyKey: crypto.randomUUID() },
  });
}

describe("ResearchService", () => {
  it("creates root, immutable revision, owner event, transition, and audit atomically", async () => {
    const correlationId = crypto.randomUUID();
    const created = await service().create({
      actor: actor(),
      correlationId,
      input: {
        ...content(),
        scope: { projectId: ids.project, workstreamId: ids.workstream, workItemId: ids.workItem },
        idempotencyKey: crypto.randomUUID(),
      },
    });

    expect(created).toMatchObject({ ownerId: ids.owner, state: "DRAFT", revision: 1, version: 1 });
    await expect(
      client.researchParticipantEvent.findMany({ where: { researchId: created.id } }),
    ).resolves.toEqual([
      expect.objectContaining({ employeeId: ids.owner, role: "OWNER", action: "STARTED" }),
    ]);
    await expect(
      client.researchTransition.findFirstOrThrow({ where: { researchId: created.id } }),
    ).resolves.toMatchObject({ fromState: null, toState: "DRAFT", resultingVersion: 1 });
    await expect(
      client.auditEvent.findFirstOrThrow({ where: { correlationId } }),
    ).resolves.toMatchObject({ eventType: "research.created", targetId: created.id });
  });

  it("rejects caller-supplied and unknown source reference shapes", async () => {
    await expect(
      service().create({
        actor: actor(),
        correlationId: crypto.randomUUID(),
        input: {
          ...content(),
          sourceReferences: [`project:${ids.project}`],
          scope: { projectId: ids.project, workstreamId: null, workItemId: null },
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_INVALID" });
    const research = await createDraft();
    await expect(
      service().addSource({
        actor: actor(),
        researchId: research.id,
        correlationId: crypto.randomUUID(),
        input: {
          expectedVersion: 1,
          source: { kind: "REFLECTED_SOURCE", sourceId: crypto.randomUUID() },
          kind: "PAPER",
          title: "Unknown source",
          relevanceNote: "Must not pass runtime validation",
          credibilityNote: "No governed provenance",
        } as never,
      }),
    ).rejects.toMatchObject({ name: "ZodError" });
  });

  it("binds a confirmed Research proposal to a governed source on creation", async () => {
    const review = await client.researchSourceReview.create({
      data: {
        projectId: ids.project,
        ownerId: ids.owner,
        idempotencyKey: crypto.randomUUID(),
        sourceKind: "URL",
        sealedSource: { ciphertext: "fixture", keyVersion: "v1" },
        state: "CONFIRMED",
      },
    });
    const proposal = await client.researchProposal.create({
      data: {
        reviewId: review.id,
        kind: "RESEARCH",
        state: "CONFIRMED",
        title: "Investigate retrieval quality",
        rationale: "Confirmed proposal from the governed source review.",
        content: { ciphertext: "proposal", keyVersion: "v1" },
        sourceReferences: [],
      },
    });
    const idempotencyKey = crypto.randomUUID();
    const createCommand = {
      actor: actor(),
      correlationId: crypto.randomUUID(),
      confirmedProposalId: proposal.id,
      input: {
        ...content(),
        scope: { projectId: ids.project, workstreamId: null, workItemId: null },
        idempotencyKey,
      },
    };
    const created = await service().create(createCommand);
    await expect(service().create(createCommand)).resolves.toMatchObject({ id: created.id });
    await expect(
      service().create({ ...createCommand, confirmedProposalId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "RESEARCH_REPLAY_MISMATCH" });
    const source = await client.researchSourceReference.findFirstOrThrow({
      where: { researchId: created.id },
    });
    expect(source).toMatchObject({ sourceReviewId: review.id, state: "ACTIVE" });
    expect(created.currentRevision.sourceReferences).toEqual([`research-source:${source.id}`]);
  });

  it("rejects cross-Project narrower scope before persisting anything", async () => {
    const idempotencyKey = crypto.randomUUID();
    await expect(
      service().create({
        actor: actor(),
        correlationId: crypto.randomUUID(),
        input: {
          ...content(),
          scope: {
            projectId: ids.project,
            workstreamId: ids.foreignWorkstream,
            workItemId: null,
          },
          idempotencyKey,
        },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_FORBIDDEN" });
    await expect(
      client.researchRecord.findFirst({ where: { ownerId: ids.owner, idempotencyKey } }),
    ).resolves.toBeNull();
  });

  it("appends revisions and rejects stale optimistic versions without mutating history", async () => {
    const research = await createDraft();
    const revised = await service().revise({
      actor: actor(),
      researchId: research.id,
      correlationId: crypto.randomUUID(),
      input: { ...content("What is the grounded answer?"), expectedVersion: 1 },
    });
    expect(revised).toMatchObject({ revision: 2, version: 2 });
    await expect(
      service().revise({
        actor: actor(),
        researchId: research.id,
        correlationId: crypto.randomUUID(),
        input: { ...content("Stale revision"), expectedVersion: 1 },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_VERSION_CONFLICT" });
    await expect(
      client.researchRevision.count({ where: { researchId: research.id } }),
    ).resolves.toBe(2);
  });

  it("persists AI framing as an inactive draft until the employee explicitly confirms it", async () => {
    const research = await createDraft();
    const assistant = {
      async frameResearch(
        _command: unknown,
        persist: (transaction: unknown, output: unknown) => Promise<unknown>,
      ) {
        const output = {
          schemaVersion: "research-frame-output.v1",
          ...content("Which source strategy should be adopted?"),
          nextQuestion: null,
          requiresHumanApproval: true,
        };
        await persist(undefined, output);
        return {
          output,
          outputReference: `research-revision:${crypto.randomUUID()}`,
          promptVersion: "research-frame-prompt.v1",
          requiresHumanApproval: true as const,
          routeTrace: {
            aiRunId: ids.aiRun,
            routeKey: "research.frame.v1",
            routeConfigId: ids.routeConfig,
            routeConfigVersion: 1,
          },
        };
      },
      async synthesizeResearch() {
        throw new Error("Not used");
      },
    };
    const lifecycle = service({ assistant });
    const draft = await lifecycle.prepareFrame({
      actor: actor(),
      researchId: research.id,
      correlationId: crypto.randomUUID(),
    });
    expect(draft).toMatchObject({ origin: "AI_DRAFT", revision: 2, active: false });
    await expect(
      queries.readDraft({
        actor: actor(),
        researchId: research.id,
        revision: draft.revision,
      }),
    ).resolves.toMatchObject({ revision: 2, origin: "AI_DRAFT" });
    await expect(
      queries.readDraft({
        actor: actor(ids.contributor),
        researchId: research.id,
        revision: draft.revision,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_FORBIDDEN" });
    await expect(
      queries.readDraft({
        actor: actor(ids.outsider),
        researchId: research.id,
        revision: draft.revision,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_FORBIDDEN" });
    await expect(
      queries.readDraft({
        actor: actor(ids.owner, false),
        researchId: research.id,
        revision: draft.revision,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_FORBIDDEN" });
    await expect(
      client.researchRecord.findUniqueOrThrow({ where: { id: research.id } }),
    ).resolves.toMatchObject({
      revision: 1,
      version: 1,
    });
    const contributorChange = await lifecycle.changeContributor({
      actor: actor(),
      researchId: research.id,
      correlationId: crypto.randomUUID(),
      input: {
        expectedVersion: 1,
        employeeId: ids.contributor,
        action: "ADD",
        effectiveAt: new Date(now.getTime() - 86_400_000).toISOString(),
        reason: "Joins after an inactive draft",
      },
    });
    expect(contributorChange).toMatchObject({ revision: 1, version: 2 });
    await expect(
      client.researchParticipantEvent.findFirstOrThrow({
        where: { researchId: research.id, employeeId: ids.contributor, role: "CONTRIBUTOR" },
      }),
    ).resolves.toMatchObject({
      effectiveAt: new Date(now.getTime() + 1),
      createdAt: new Date(now.getTime() + 1),
    });
    const secondDraft = await lifecycle.prepareFrame({
      actor: actor(),
      researchId: research.id,
      correlationId: crypto.randomUUID(),
    });
    expect(secondDraft).toMatchObject({ revision: 3, active: false });
    const confirmed = await lifecycle.confirmAiRevision({
      actor: actor(),
      researchId: research.id,
      correlationId: crypto.randomUUID(),
      input: { expectedVersion: 2, revision: secondDraft.revision },
    });
    expect(confirmed).toMatchObject({ revision: 3, version: 3 });
  });

  it("transfers one active owner with paired events at the same instant and an atomic audit", async () => {
    const research = await createDraft();
    const correlationId = crypto.randomUUID();
    const callerControlledFuture = "2026-09-06T10:15:00.000Z";
    const transferred = await service().transferOwner({
      actor: actor(),
      researchId: research.id,
      correlationId,
      input: {
        expectedVersion: 1,
        toUserId: ids.successor,
        effectiveAt: callerControlledFuture,
        reason: "Approved handoff",
      },
    });
    expect(transferred).toMatchObject({ ownerId: ids.successor, version: 2 });
    const events = await client.researchParticipantEvent.findMany({
      where: { researchId: research.id, role: "OWNER" },
      orderBy: [{ effectiveAt: "asc" }, { id: "asc" }],
    });
    expect(events.filter(({ reason }) => reason === "Approved handoff")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeId: ids.owner,
          action: "ENDED",
          effectiveAt: new Date(now.getTime() + 1),
        }),
        expect.objectContaining({
          employeeId: ids.successor,
          action: "STARTED",
          effectiveAt: new Date(now.getTime() + 1),
        }),
      ]),
    );
    await expect(
      client.auditEvent.findFirstOrThrow({ where: { correlationId } }),
    ).resolves.toMatchObject({ eventType: "research.owner_transferred" });
    await expect(
      service().transferOwner({
        actor: actor(ids.successor),
        researchId: research.id,
        correlationId: crypto.randomUUID(),
        input: {
          expectedVersion: 1,
          toUserId: ids.owner,
          effectiveAt: callerControlledFuture,
          reason: "Stale",
        },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_VERSION_CONFLICT" });
  });

  it("keeps contributor changes append-only without fabricating acknowledgments", async () => {
    const research = await createDraft();
    const added = await service().changeContributor({
      actor: actor(),
      researchId: research.id,
      correlationId: crypto.randomUUID(),
      input: {
        expectedVersion: 1,
        employeeId: ids.contributor,
        action: "ADD",
        effectiveAt: now.toISOString(),
        reason: "Joins research",
      },
    });
    await service().changeContributor({
      actor: actor(),
      researchId: research.id,
      correlationId: crypto.randomUUID(),
      input: {
        expectedVersion: added.version,
        employeeId: ids.contributor,
        action: "REMOVE",
        effectiveAt: new Date(now.getTime() + 1_000).toISOString(),
        reason: "Work completed",
      },
    });
    const events = await client.researchParticipantEvent.findMany({
      where: { researchId: research.id, employeeId: ids.contributor },
    });
    expect(events.map(({ action }) => action).sort()).toEqual(["ENDED", "STARTED"]);
  });

  it("blocks conclusion until Task 9 and requires governed cancellation or supersession", async () => {
    const draft = await createDraft();
    const active = await service().transition({
      actor: actor(),
      researchId: draft.id,
      correlationId: crypto.randomUUID(),
      input: { expectedVersion: 1, state: "ACTIVE", reason: null, successorResearchId: null },
    });
    await expect(
      service().transition({
        actor: actor(),
        researchId: draft.id,
        correlationId: crypto.randomUUID(),
        input: {
          expectedVersion: active.version,
          state: "CONCLUDED",
          reason: null,
          successorResearchId: null,
        },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_STATE_INVALID" });
    const cancelled = await service().transition({
      actor: actor(),
      researchId: draft.id,
      correlationId: crypto.randomUUID(),
      input: {
        expectedVersion: active.version,
        state: "CANCELLED",
        reason: "No longer needed",
        successorResearchId: null,
      },
    });
    expect(cancelled.state).toBe("CANCELLED");
  });

  it("does not expose or accept another owner's DRAFT as a supersession successor", async () => {
    const original = await createDraft();
    const hiddenDraft = await service().create({
      actor: actor(ids.contributor),
      correlationId: crypto.randomUUID(),
      input: {
        ...content("Should this private draft replace the original?"),
        scope: { projectId: ids.project, workstreamId: null, workItemId: null },
        idempotencyKey: crypto.randomUUID(),
      },
    });
    await expect(
      service().transition({
        actor: actor(),
        researchId: original.id,
        correlationId: crypto.randomUUID(),
        input: {
          expectedVersion: original.version,
          state: "SUPERSEDED",
          reason: "Attempt to use an invisible successor",
          successorResearchId: hiddenDraft.id,
        },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SUCCESSOR_INVALID" });
  });

  it("adds only governed sources and retracts by append-only successor event", async () => {
    const research = await createDraft();
    await expect(
      service().addSource({
        actor: actor(),
        researchId: research.id,
        correlationId: crypto.randomUUID(),
        input: {
          expectedVersion: 1,
          source: { kind: "SOURCE_REVIEW", sourceReviewId: crypto.randomUUID() },
          kind: "PAPER",
          title: "Unconfirmed paper",
          relevanceNote: "Potential relevance",
          credibilityNote: "Not confirmed",
        },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_INVALID" });
    const source = await service().addSource({
      actor: actor(),
      researchId: research.id,
      correlationId: crypto.randomUUID(),
      input: {
        expectedVersion: 1,
        source: { kind: "MANUAL_CITATION", canonicalUrl: "https://example.com/paper" },
        kind: "PAPER",
        title: "Manual paper",
        relevanceNote: "Supports the question",
        credibilityNote: "Employee-reviewed citation",
      },
    });
    const duplicate = await service().addSource({
      actor: actor(),
      researchId: research.id,
      correlationId: crypto.randomUUID(),
      input: {
        expectedVersion: source.version,
        source: { kind: "MANUAL_CITATION", canonicalUrl: "https://example.com/paper" },
        kind: "PAPER",
        title: "Manual paper duplicate citation",
        relevanceNote: "Supports a distinct claim",
        credibilityNote: "Employee-reviewed citation",
      },
    });
    const retracted = await service().retractSource({
      actor: actor(),
      researchId: research.id,
      sourceReferenceId: source.sourceReferenceId,
      correlationId: crypto.randomUUID(),
      input: { expectedVersion: duplicate.version, reason: "Citation withdrawn" },
    });
    expect(retracted.version).toBe(duplicate.version + 1);
    await expect(
      service().revise({
        actor: actor(),
        researchId: research.id,
        correlationId: crypto.randomUUID(),
        input: {
          ...content("Can a retracted citation support this revision?"),
          expectedVersion: retracted.version,
          sourceReferences: [source.sourceReference],
        },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SOURCE_INVALID" });
    const revised = await service().revise({
      actor: actor(),
      researchId: research.id,
      correlationId: crypto.randomUUID(),
      input: {
        ...content("Does the remaining governed citation support this revision?"),
        expectedVersion: retracted.version,
        sourceReferences: [duplicate.sourceReference],
      },
    });
    expect(revised.currentRevision.sourceReferences).toEqual([duplicate.sourceReference]);
    const projected = await queries.read({ actor: actor(), researchId: research.id });
    expect(projected.sourceReferences.map(({ id }) => id)).toEqual([duplicate.sourceReferenceId]);
    const rows = await client.researchSourceReference.findMany({
      where: { researchId: research.id },
      orderBy: { createdAt: "asc" },
    });
    expect(rows).toHaveLength(3);
    expect(rows.filter(({ state }) => state === "ACTIVE")).toHaveLength(2);
    expect(rows.find(({ state }) => state === "RETRACTED")).toMatchObject({
      state: "RETRACTED",
      reason: "Citation withdrawn",
      citedLocations: [
        {
          schemaVersion: "research-source-retraction.v1",
          predecessorSourceReferenceId: source.sourceReferenceId,
        },
      ],
    });
  });
});

function forbidden() {
  return Object.assign(new Error("Forbidden"), { code: "RESEARCH_FORBIDDEN" });
}

async function seedAiTrace() {
  const suffix = crypto.randomUUID();
  const routeKey = `research.frame.fixture.${suffix}`;
  const route = await client.aiRoute.create({
    data: { routeKey, level: "project", scopeId: ids.project },
  });
  const routeConfig = await client.aiRouteConfig.create({
    data: {
      routeId: route.id,
      version: 1,
      reason: "Research frame fixture",
      createdById: ids.owner,
    },
  });
  const provider = await client.aiProviderConfig.create({
    data: {
      providerKey: `research-frame-${suffix}`,
      version: 1,
      adapterKey: "fixture",
      modelKey: "fixture-model",
      locality: "external",
      endpoint: "https://provider.example.invalid/v1/chat/completions",
      endpointProtocol: "https",
      endpointHost: "provider.example.invalid",
      reason: "Research frame fixture",
      createdById: ids.owner,
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
      version: "research-frame-output.v1",
      schemaHash: "f".repeat(64),
      schemaArtifact: {},
      reason: "Research frame fixture",
      expectedBehavior: "Supplies governed framing provenance.",
      evaluationEvidenceReferences: [`ai-eval:${crypto.randomUUID()}`],
      humanApprovalPolicy: "feature_defined",
      createdById: ids.owner,
    },
  });
  const run = await client.aiRun.create({
    data: {
      routeKey,
      routeId: route.id,
      routeConfigId: routeConfig.id,
      routeConfigVersion: 1,
      routeLevel: "project",
      scopeId: ids.project,
      routeConfigProviderId: routeProvider.id,
      providerConfigId: provider.id,
      providerConfigVersion: provider.version,
      classification: "confidential",
      inputReference: `project:${ids.project}`,
      inputSchemaVersion: "research-frame-input.v1",
      outputSchemaVersion: artifact.version,
      outputSchemaArtifactId: artifact.id,
      outputSchemaHash: artifact.schemaHash,
      promptTemplateVersion: "research-frame-prompt.v1",
      sourceReferences: [`project:${ids.project}`],
      outputReference: `research-revision:${crypto.randomUUID()}`,
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
