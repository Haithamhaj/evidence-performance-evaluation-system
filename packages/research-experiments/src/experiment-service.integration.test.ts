import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ExperimentService } from "./experiment-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-08-06T12:00:00.000Z");
const ids = {
  owner: crypto.randomUUID(),
  member: crypto.randomUUID(),
  project: crypto.randomUUID(),
  workstream: crypto.randomUUID(),
  workItem: crypto.randomUUID(),
  research: crypto.randomUUID(),
};

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `experiment-service-${suffix}`, name: "Experiment service" },
  });
  const department = await client.department.create({
    data: {
      key: `experiment-service-department-${suffix}`,
      name: "Experiment service",
      organizationId: organization.id,
    },
  });
  await client.user.createMany({
    data: [
      { id: ids.owner, email: `experiment-owner-${suffix}@example.invalid`, displayName: "Owner" },
      {
        id: ids.member,
        email: `experiment-member-${suffix}@example.invalid`,
        displayName: "Member",
      },
    ],
  });
  await client.authorizationScope.create({
    data: {
      id: ids.project,
      key: `experiment-project-${suffix}`,
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
      name: "Experiment project",
      description: "Experiment fixture",
      status: "active",
      createdById: ids.owner,
    },
  });
  await client.projectMember.createMany({
    data: [ids.owner, ids.member].map((employeeId) => ({
      projectId: ids.project,
      employeeId,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      endsAt: null,
      reason: "Experiment fixture",
      createdById: ids.owner,
    })),
  });
  await client.authorizationScope.create({
    data: {
      id: ids.workstream,
      key: `experiment-workstream-${suffix}`,
      scopeType: "workstream",
      departmentId: department.id,
    },
  });
  await client.workstream.create({
    data: {
      id: ids.workstream,
      projectId: ids.project,
      authorizationScopeId: ids.workstream,
      name: "Experiment workstream",
      description: "Experiment workstream",
      status: "active",
      createdById: ids.owner,
    },
  });
  await client.workItem.create({
    data: {
      id: ids.workItem,
      projectId: ids.project,
      workstreamId: ids.workstream,
      title: "Experiment work item",
      description: "Experiment work item",
      requirements: [],
      acceptanceConditions: [],
      createdById: ids.owner,
    },
  });
  await client.researchRecord.create({
    data: {
      id: ids.research,
      idempotencyKey: crypto.randomUUID(),
      projectId: ids.project,
      workstreamId: ids.workstream,
      workItemId: ids.workItem,
      ownerId: ids.owner,
      state: "ACTIVE",
      revision: 1,
      version: 2,
      revisions: {
        create: {
          revision: 1,
          origin: "EMPLOYEE",
          problemStatement: "Retrieval needs validation.",
          context: "A bounded benchmark exists.",
          question: "Does retrieval improve grounding?",
          objective: "Choose a retrieval approach.",
          hypothesisKind: "TESTABLE",
          hypothesisStatement: "Retrieval improves grounding.",
          assumptions: [],
          constraints: [],
          knownUncertainty: [],
          alternatives: [],
          decisionQuestion: "Should retrieval be adopted?",
          sourceReferences: [],
          executionMode: "manual",
          authorId: ids.owner,
          createdAt: now,
        },
      },
      participantEvents: {
        create: {
          employeeId: ids.owner,
          role: "OWNER",
          action: "STARTED",
          effectiveAt: now,
          reason: "Created",
          actorId: ids.owner,
          createdAt: now,
        },
      },
      transitions: {
        createMany: {
          data: [
            {
              fromState: null,
              toState: "DRAFT",
              actorId: ids.owner,
              resultingVersion: 1,
              effectiveAt: now,
              createdAt: now,
            },
            {
              fromState: "DRAFT",
              toState: "ACTIVE",
              actorId: ids.owner,
              resultingVersion: 2,
              effectiveAt: now,
              createdAt: now,
            },
          ],
        },
      },
    },
  });
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

async function authorizeUsing(database: any, { actor, scope, at }: any) {
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
    !actor.active ||
    membership === null ||
    (scope.workstreamId !== null && workstream === null) ||
    (scope.workItemId !== null && workItem === null)
  ) {
    throw Object.assign(new Error("Forbidden"), { code: "RESEARCH_FORBIDDEN" });
  }
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
  return new ExperimentService({
    database: client,
    authorizer,
    auditWriter: auditWriter as never,
    clock: () => now,
    idFactory: () => crypto.randomUUID(),
    ...overrides,
  });
}

function actor(userId = ids.owner, active = true) {
  return { userId, active };
}

function method(): Omit<import("@evaluation/contracts").ReviseExperimentMethodInput, "expectedVersion"> {
  return {
    question: "Does retrieval reduce p95 latency?",
    baseline: { description: "Current retrieval path", value: "120", sourceReference: null },
    measures: [
      {
        stableId: "p95_latency_ms",
        name: "p95 latency",
        kind: "NUMERIC" as const,
        unit: "ms",
        direction: "LOWER" as const,
        baselineValue: "120",
        baselineReference: null,
        interpretationRule: "Lower than 120ms is favorable.",
      },
    ],
    testCases: [
      {
        id: crypto.randomUUID(),
        inputIdentity: "retrieval-benchmark-v1",
        expectedObservation: "Record p95 latency.",
        category: "benchmark",
        inclusionReason: "Represents the bounded sample.",
      },
    ],
    controls: [{ comparisonTarget: "Current path", constantConditions: "Same sample." }],
    conditions: ["Same runtime and sample."],
    reproducibilityInstructions: "Run the benchmark with the recorded configuration.",
    knownRisks: ["The sample is bounded."],
    failureCases: ["The benchmark cannot start."],
    sourceReferences: [],
    executionMode: "manual" as const,
  };
}

async function createExperiment(title = "Retrieval latency") {
  return service().create({
    actor: actor(),
    correlationId: crypto.randomUUID(),
    input: {
      researchId: ids.research,
      scope: { projectId: ids.project, workstreamId: ids.workstream, workItemId: ids.workItem },
      idempotencyKey: crypto.randomUUID(),
      title,
    },
    method: method(),
  });
}

async function createResearchFixture() {
  return client.researchRecord.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      projectId: ids.project,
      ownerId: ids.owner,
      state: "ACTIVE",
      revision: 1,
      version: 2,
      revisions: {
        create: {
          revision: 1,
          origin: "EMPLOYEE",
          problemStatement: "Separate governed research.",
          context: "Citation boundary fixture.",
          question: "Is this source isolated?",
          objective: "Verify exact Research ownership.",
          hypothesisKind: "NO_HYPOTHESIS",
          noHypothesisReason: "Boundary verification.",
          assumptions: [],
          constraints: [],
          knownUncertainty: [],
          alternatives: [],
          decisionQuestion: "May this source cross Research roots?",
          sourceReferences: [],
          executionMode: "manual",
          authorId: ids.owner,
          createdAt: now,
        },
      },
    },
  });
}

async function createSource(
  researchId: string,
  input: { state?: "ACTIVE" | "RETRACTED"; citedLocations?: unknown[]; reason?: string } = {},
) {
  return client.researchSourceReference.create({
    data: {
      researchId,
      kind: "PAPER",
      title: "Governed source",
      relevanceNote: "Supports the bounded experiment.",
      credibilityNote: "Reviewed fixture.",
      retrievalState: "RETRIEVED",
      citedLocations: (input.citedLocations ?? []) as never,
      state: input.state ?? "ACTIVE",
      reason: input.state === "RETRACTED" ? (input.reason ?? "Fixture retraction") : null,
      addedById: ids.owner,
      createdAt: now,
    },
  });
}

async function createSucceededInterpretationRun(inputReference: string) {
  const suffix = crypto.randomUUID();
  const route = await client.aiRoute.upsert({
    where: {
      routeKey_level_scopeId: {
        routeKey: "experiment.interpret.v1",
        level: "project",
        scopeId: ids.project,
      },
    },
    update: {},
    create: { routeKey: "experiment.interpret.v1", level: "project", scopeId: ids.project },
  });
  const latestConfig = await client.aiRouteConfig.findFirst({
    where: { routeId: route.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const routeConfigVersion = (latestConfig?.version ?? 0) + 1;
  const routeConfig = await client.aiRouteConfig.create({
    data: {
      routeId: route.id,
      version: routeConfigVersion,
      reason: "Experiment interpretation provenance fixture",
      createdById: ids.owner,
    },
  });
  const provider = await client.aiProviderConfig.create({
    data: {
      providerKey: `experiment-interpret-${suffix}`,
      version: 1,
      adapterKey: "fixture",
      modelKey: "fixture-model",
      locality: "external",
      endpoint: "https://provider.example.invalid/v1/chat/completions",
      endpointProtocol: "https",
      endpointHost: "provider.example.invalid",
      reason: "Experiment interpretation provenance fixture",
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
      routeKey: route.routeKey,
      version: `experiment-interpret-output.fixture-${suffix}`,
      schemaHash: "e".repeat(64),
      schemaArtifact: {},
      reason: "Experiment interpretation provenance fixture",
      expectedBehavior: "Produces a governed interpretation draft.",
      evaluationEvidenceReferences: [`ai-eval:${crypto.randomUUID()}`],
      humanApprovalPolicy: "feature_defined",
      createdById: ids.owner,
    },
  });
  return client.aiRun.create({
    data: {
      routeKey: route.routeKey,
      routeId: route.id,
      routeConfigId: routeConfig.id,
      routeConfigVersion,
      routeLevel: "project",
      scopeId: ids.project,
      routeConfigProviderId: routeProvider.id,
      providerConfigId: provider.id,
      providerConfigVersion: provider.version,
      projectScopeId: ids.project,
      projectScopeType: "project",
      classification: "confidential",
      inputReference,
      inputSchemaVersion: "experiment-interpret-input.v1",
      outputSchemaVersion: artifact.version,
      outputSchemaArtifactId: artifact.id,
      outputSchemaHash: artifact.schemaHash,
      promptTemplateVersion: "experiment-interpret-prompt.v1",
      sourceReferences: [inputReference],
      outputReference: `experiment-interpretation:${crypto.randomUUID()}`,
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
}

async function createRecordedExperiment(title: string) {
  const experiment = await createExperiment(title);
  const ready = await service().transition({
    actor: actor(),
    experimentId: experiment.id,
    correlationId: crypto.randomUUID(),
    input: { expectedVersion: 1, state: "READY", reason: null, successorExperimentId: null },
  });
  const run = await service().recordRun({
    actor: actor(),
    experimentId: experiment.id,
    correlationId: crypto.randomUUID(),
    input: {
      expectedVersion: ready.version,
      methodRevisionId: ready.currentMethod.id,
      startedAt: "2026-08-06T11:55:00.000Z",
      completedAt: "2026-08-06T12:00:00.000Z",
      resultStatus: "COMPLETED",
      environment: [],
      inputs: [],
      modelConfigurations: [],
      observations: [
        {
          measureStableId: "p95_latency_ms",
          testCaseId: null,
          observedValue: "98",
          unit: "ms",
          note: null,
        },
      ],
      unexpectedConditions: [],
      executionNotes: "Recorded for provenance verification.",
      sourceReferences: [],
    },
  });
  return { experiment, run };
}

describe("ExperimentService", () => {
  it("allows one active Research to contain multiple immutable-method Experiments", async () => {
    const first = await createExperiment("Retrieval latency A");
    const second = await createExperiment("Retrieval latency B");

    expect(first.researchId).toBe(ids.research);
    expect(second.researchId).toBe(ids.research);
    expect(first.id).not.toBe(second.id);
    await expect(
      client.experimentMethodRevision.count({ where: { experimentId: first.id } }),
    ).resolves.toBe(1);
  });

  it("requires method completeness before READY and appends an audit transition", async () => {
    const experiment = await createExperiment();
    const correlationId = crypto.randomUUID();
    const ready = await service().transition({
      actor: actor(),
      experimentId: experiment.id,
      correlationId,
      input: { expectedVersion: 1, state: "READY", reason: null, successorExperimentId: null },
    });
    expect(ready).toMatchObject({ state: "READY", version: 2 });
    await expect(
      client.auditEvent.findFirstOrThrow({ where: { correlationId } }),
    ).resolves.toMatchObject({
      eventType: "experiment.ready",
      safeDiff: expect.objectContaining({ fromState: "DRAFT", toState: "READY" }),
    });
  });

  it.each(["COMPLETED", "FAILED", "INVALID", "STOPPED"] as const)(
    "retains an immutable %s run pinned to its method revision",
    async (resultStatus) => {
      const experiment = await createExperiment(`Run ${resultStatus}`);
      const ready = await service().transition({
        actor: actor(),
        experimentId: experiment.id,
        correlationId: crypto.randomUUID(),
        input: { expectedVersion: 1, state: "READY", reason: null, successorExperimentId: null },
      });
      const run = await service().recordRun({
        actor: actor(),
        experimentId: experiment.id,
        correlationId: crypto.randomUUID(),
        input: {
          expectedVersion: ready.version,
          methodRevisionId: ready.currentMethod.id,
          startedAt: "2026-08-06T11:55:00.000Z",
          completedAt: "2026-08-06T12:00:00.000Z",
          resultStatus,
          environment: [{ name: "runtime", value: "node-24" }],
          inputs: [{ name: "sample", value: "retrieval-benchmark-v1" }],
          modelConfigurations: [{ name: "model", value: "retrieval-v2" }],
          observations: [
            {
              measureStableId: "p95_latency_ms",
              testCaseId: ready.currentMethod.testCases[0]!.id,
              observedValue: resultStatus === "COMPLETED" ? "98" : "not available",
              unit: "ms",
              note: "Retained bounded result.",
            },
          ],
          unexpectedConditions:
            resultStatus === "COMPLETED" ? [] : ["Execution did not complete normally."],
          executionNotes: "The immutable outcome is retained.",
          sourceReferences: [],
        },
      });
      expect(run).toMatchObject({
        sequence: 1,
        resultStatus,
        methodRevisionId: ready.currentMethod.id,
      });
      await expect(
        client.experimentRun.findUniqueOrThrow({ where: { id: run.id } }),
      ).resolves.toMatchObject({ resultStatus });
    },
  );

  it("rejects observations outside the pinned method and appends a superseding correction", async () => {
    const experiment = await createExperiment("Correction");
    const ready = await service().transition({
      actor: actor(),
      experimentId: experiment.id,
      correlationId: crypto.randomUUID(),
      input: { expectedVersion: 1, state: "READY", reason: null, successorExperimentId: null },
    });
    await expect(
      service().recordRun({
        actor: actor(),
        experimentId: experiment.id,
        correlationId: crypto.randomUUID(),
        input: {
          expectedVersion: 2,
          methodRevisionId: ready.currentMethod.id,
          startedAt: "2026-08-06T11:55:00.000Z",
          completedAt: "2026-08-06T12:00:00.000Z",
          resultStatus: "COMPLETED",
          environment: [],
          inputs: [],
          modelConfigurations: [],
          observations: [
            {
              measureStableId: "undeclared",
              testCaseId: null,
              observedValue: "1",
              unit: null,
              note: null,
            },
          ],
          unexpectedConditions: [],
          executionNotes: "Rejected",
          sourceReferences: [],
        },
      }),
    ).rejects.toMatchObject({ code: "EXPERIMENT_OBSERVATION_INVALID" });

    const run = await service().recordRun({
      actor: actor(),
      experimentId: experiment.id,
      correlationId: crypto.randomUUID(),
      input: {
        expectedVersion: 2,
        methodRevisionId: ready.currentMethod.id,
        startedAt: "2026-08-06T11:55:00.000Z",
        completedAt: "2026-08-06T12:00:00.000Z",
        resultStatus: "COMPLETED",
        environment: [],
        inputs: [],
        modelConfigurations: [],
        observations: [
          {
            measureStableId: "p95_latency_ms",
            testCaseId: null,
            observedValue: "98",
            unit: "ms",
            note: null,
          },
        ],
        unexpectedConditions: [],
        executionNotes: "Recorded",
        sourceReferences: [],
      },
    });
    const original = await client.experimentObservation.findFirstOrThrow({
      where: { runId: run.id },
    });
    const corrected = await service().correctObservation({
      actor: actor(),
      experimentId: experiment.id,
      correlationId: crypto.randomUUID(),
      input: {
        expectedVersion: 3,
        observationId: original.id,
        observedValue: "101",
        unit: "ms",
        note: "Corrected transcription.",
        reason: "Transcription error",
      },
    });
    expect(corrected).toMatchObject({ supersedesObservationId: original.id, observedValue: "101" });
    await expect(client.experimentObservation.count({ where: { runId: run.id } })).resolves.toBe(2);
  });

  it("rejects a new run against a superseded method revision", async () => {
    const experiment = await createExperiment("Pinned current method");
    const ready = await service().transition({
      actor: actor(),
      experimentId: experiment.id,
      correlationId: crypto.randomUUID(),
      input: { expectedVersion: 1, state: "READY", reason: null, successorExperimentId: null },
    });
    const revised = await service().reviseMethod({
      actor: actor(),
      experimentId: experiment.id,
      correlationId: crypto.randomUUID(),
      input: {
        ...method(),
        question: "Does the revised method reduce p95 latency?",
        expectedVersion: 2,
      },
    });
    await expect(
      service().recordRun({
        actor: actor(),
        experimentId: experiment.id,
        correlationId: crypto.randomUUID(),
        input: {
          expectedVersion: revised.version,
          methodRevisionId: ready.currentMethod.id,
          startedAt: "2026-08-06T11:55:00.000Z",
          completedAt: "2026-08-06T12:00:00.000Z",
          resultStatus: "COMPLETED",
          environment: [],
          inputs: [],
          modelConfigurations: [],
          observations: [],
          unexpectedConditions: [],
          executionNotes: "Old method must not run.",
          sourceReferences: [],
        },
      }),
    ).rejects.toMatchObject({ code: "EXPERIMENT_OBSERVATION_INVALID" });
  });

  it("rejects method baseline citations whose active predecessor was append-only retracted", async () => {
    const source = await createSource(ids.research);
    await createSource(ids.research, {
      state: "RETRACTED",
      citedLocations: [
        {
          schemaVersion: "research-source-retraction.v1",
          predecessorSourceReferenceId: source.id,
        },
      ],
    });
    const citation = `research-source:${source.id}`;
    const citedMethod = method();
    citedMethod.sourceReferences = [citation];
    citedMethod.baseline.sourceReference = citation;

    await expect(
      service().create({
        actor: actor(),
        correlationId: crypto.randomUUID(),
        input: {
          researchId: ids.research,
          scope: {
            projectId: ids.project,
            workstreamId: ids.workstream,
            workItemId: ids.workItem,
          },
          idempotencyKey: crypto.randomUUID(),
          title: "Retracted baseline",
        },
        method: citedMethod,
      }),
    ).rejects.toMatchObject({ code: "EXPERIMENT_SOURCE_INVALID" });
  });

  it("rejects cross-Research baseline and run source references", async () => {
    const otherResearch = await createResearchFixture();
    const otherSource = await createSource(otherResearch.id);
    const citation = `research-source:${otherSource.id}`;
    const crossResearchMethod = method();
    crossResearchMethod.measures[0]!.baselineReference = citation;
    await expect(
      service().create({
        actor: actor(),
        correlationId: crypto.randomUUID(),
        input: {
          researchId: ids.research,
          scope: {
            projectId: ids.project,
            workstreamId: ids.workstream,
            workItemId: ids.workItem,
          },
          idempotencyKey: crypto.randomUUID(),
          title: "Cross Research baseline",
        },
        method: crossResearchMethod,
      }),
    ).rejects.toMatchObject({ code: "EXPERIMENT_SOURCE_INVALID" });

    const experiment = await createExperiment("Cross Research run");
    const ready = await service().transition({
      actor: actor(),
      experimentId: experiment.id,
      correlationId: crypto.randomUUID(),
      input: { expectedVersion: 1, state: "READY", reason: null, successorExperimentId: null },
    });
    await expect(
      service().recordRun({
        actor: actor(),
        experimentId: experiment.id,
        correlationId: crypto.randomUUID(),
        input: {
          expectedVersion: ready.version,
          methodRevisionId: ready.currentMethod.id,
          startedAt: "2026-08-06T11:55:00.000Z",
          completedAt: "2026-08-06T12:00:00.000Z",
          resultStatus: "COMPLETED",
          environment: [],
          inputs: [],
          modelConfigurations: [],
          observations: [],
          unexpectedConditions: [],
          executionNotes: "Cross Research citation must be rejected.",
          sourceReferences: [citation],
        },
      }),
    ).rejects.toMatchObject({ code: "EXPERIMENT_SOURCE_INVALID" });
  });

  it.each(["NOT_SUPPORTED", "INCONCLUSIVE"] as const)(
    "allows a human to confirm the %s conclusion without AI acting as confirmer",
    async (outcome) => {
      const experiment = await createExperiment(`Conclusion ${outcome}`);
      const ready = await service().transition({
        actor: actor(),
        experimentId: experiment.id,
        correlationId: crypto.randomUUID(),
        input: { expectedVersion: 1, state: "READY", reason: null, successorExperimentId: null },
      });
      const run = await service().recordRun({
        actor: actor(),
        experimentId: experiment.id,
        correlationId: crypto.randomUUID(),
        input: {
          expectedVersion: 2,
          methodRevisionId: ready.currentMethod.id,
          startedAt: "2026-08-06T11:55:00.000Z",
          completedAt: "2026-08-06T12:00:00.000Z",
          resultStatus: "COMPLETED",
          environment: [],
          inputs: [],
          modelConfigurations: [],
          observations: [
            {
              measureStableId: "p95_latency_ms",
              testCaseId: null,
              observedValue: "121",
              unit: "ms",
              note: null,
            },
          ],
          unexpectedConditions: [],
          executionNotes: "Recorded",
          sourceReferences: [],
        },
      });
      const concluded = await service().conclude({
        actor: actor(),
        experimentId: experiment.id,
        correlationId: crypto.randomUUID(),
        input: {
          expectedVersion: 3,
          outcome,
          summary: "The bounded result does not establish an improvement.",
          runIds: [run.id],
          measureStableIds: ["p95_latency_ms"],
          limitations: ["One bounded sample."],
          confidenceDescription: "Limited confidence within the recorded sample only.",
          decisionRelevance: "Do not adopt solely from this run.",
          nextStep: "Run another bounded experiment or stop with the documented reason.",
        },
      });
      expect(concluded).toMatchObject({ outcome, confirmerId: ids.owner });
      expect(concluded.confirmerId).not.toBe("AI");
    },
  );

  it("rejects a successful interpretation trace produced for another Experiment run", async () => {
    const target = await createRecordedExperiment("Target conclusion");
    const other = await createRecordedExperiment("Other interpretation");
    const foreignAiRun = await createSucceededInterpretationRun(`experiment-run:${other.run.id}`);

    await expect(
      service().conclude({
        actor: actor(),
        experimentId: target.experiment.id,
        correlationId: crypto.randomUUID(),
        aiRunId: foreignAiRun.id,
        input: {
          expectedVersion: 3,
          outcome: "SUPPORTED",
          summary: "The target run supports the bounded hypothesis.",
          runIds: [target.run.id],
          measureStableIds: ["p95_latency_ms"],
          limitations: ["One bounded sample."],
          confidenceDescription: "Limited to the recorded target run.",
          decisionRelevance: "Use the target run only.",
          nextStep: "Confirm the bounded result with another run.",
        },
      }),
    ).rejects.toMatchObject({ code: "EXPERIMENT_CONCLUSION_INVALID" });
  });

  it("records an AI method-review draft reference and one clarification without changing state", async () => {
    const experiment = await createExperiment("AI method review");
    const aiRunId = crypto.randomUUID();
    const review = {
      schemaVersion: "experiment-method-review-output.v1",
      missingElements: ["Add a broader failure sample."],
      observations: ["The baseline and primary measure are present."],
      uncertainties: ["Sample representativeness remains uncertain."],
      sourceReferences: [`experiment-method:${experiment.currentMethod.id}`],
      nextQuestion: "Which failure sample should be included?",
      draftOnly: true as const,
      requiresHumanApproval: true as const,
    };
    const assistant = {
      async reviewExperimentMethod(
        _command: unknown,
        persist: (transaction: unknown, output: unknown) => Promise<unknown>,
      ) {
        await persist(undefined, review);
        return {
          output: review,
          outputReference: `experiment-method-review:${crypto.randomUUID()}`,
          promptVersion: "experiment-method-review-prompt.v1",
          requiresHumanApproval: true as const,
          routeTrace: {
            aiRunId,
            routeKey: "experiment.method-review.v1",
            routeConfigId: crypto.randomUUID(),
            routeConfigVersion: 1,
          },
        };
      },
      async interpretExperiment() {
        throw new Error("Not used");
      },
    };
    const result = await service({ assistant }).reviewMethod({
      actor: actor(),
      experimentId: experiment.id,
      correlationId: crypto.randomUUID(),
    });
    expect(result).toMatchObject({ review, active: false, stateChanged: false });
    await expect(
      client.experiment.findUniqueOrThrow({ where: { id: experiment.id } }),
    ).resolves.toMatchObject({ state: "DRAFT", version: 1 });
    await expect(
      client.auditEvent.findFirstOrThrow({
        where: { targetId: experiment.id, eventType: "experiment.method_review_draft_prepared" },
      }),
    ).resolves.toMatchObject({ safeDiff: expect.objectContaining({ aiRunId }) });
    const [persisted] = await client.$queryRaw<
      Array<{ body: unknown; methodRevisionId: string; aiRunId: string }>
    >`SELECT "body", "methodRevisionId", "aiRunId"
      FROM "ExperimentAiDraft"
      WHERE "experimentId" = ${experiment.id}::uuid AND "kind" = 'METHOD_REVIEW'`;
    expect(persisted).toMatchObject({
      body: review,
      methodRevisionId: experiment.currentMethod.id,
      aiRunId,
    });
  });

  it("records a cited AI interpretation draft reference without concluding the Experiment", async () => {
    const experiment = await createExperiment("AI interpretation");
    const ready = await service().transition({
      actor: actor(),
      experimentId: experiment.id,
      correlationId: crypto.randomUUID(),
      input: { expectedVersion: 1, state: "READY", reason: null, successorExperimentId: null },
    });
    const run = await service().recordRun({
      actor: actor(),
      experimentId: experiment.id,
      correlationId: crypto.randomUUID(),
      input: {
        expectedVersion: 2,
        methodRevisionId: ready.currentMethod.id,
        startedAt: "2026-08-06T11:55:00.000Z",
        completedAt: "2026-08-06T12:00:00.000Z",
        resultStatus: "FAILED",
        environment: [],
        inputs: [],
        modelConfigurations: [],
        observations: [],
        unexpectedConditions: ["Fixture failure"],
        executionNotes: "Failed safely",
        sourceReferences: [],
      },
    });
    const aiRunId = crypto.randomUUID();
    const interpretation = {
      schemaVersion: "experiment-interpret-output.v1",
      runId: run.id,
      methodRevisionId: run.methodRevisionId,
      resultStatus: "FAILED" as const,
      summary: "The failed run cannot establish the hypothesis.",
      observations: [],
      limitations: ["No completed result."],
      possibleDecisionPaths: ["Repair and rerun."],
      uncertainties: ["Outcome remains unknown."],
      sourceReferences: [`experiment-run:${run.id}`],
      draftOnly: true as const,
      requiresHumanApproval: true as const,
    };
    const assistant = {
      async reviewExperimentMethod() {
        throw new Error("Not used");
      },
      async interpretExperiment(
        _command: unknown,
        persist: (transaction: unknown, output: unknown) => Promise<unknown>,
      ) {
        await persist(undefined, interpretation);
        return {
          output: interpretation,
          outputReference: `experiment-interpretation:${crypto.randomUUID()}`,
          promptVersion: "experiment-interpret-prompt.v1",
          requiresHumanApproval: true as const,
          routeTrace: {
            aiRunId,
            routeKey: "experiment.interpret.v1",
            routeConfigId: crypto.randomUUID(),
            routeConfigVersion: 1,
          },
        };
      },
    };
    const result = await service({ assistant }).interpretRun({
      actor: actor(),
      experimentId: experiment.id,
      runId: run.id,
      correlationId: crypto.randomUUID(),
    });
    expect(result).toMatchObject({ interpretation, active: false, stateChanged: false });
    await expect(
      client.experimentConclusion.count({ where: { experimentId: experiment.id } }),
    ).resolves.toBe(0);
    await expect(
      client.experiment.findUniqueOrThrow({ where: { id: experiment.id } }),
    ).resolves.toMatchObject({ state: "RESULT_RECORDED", version: 3 });
    const [persisted] = await client.$queryRaw<
      Array<{ body: unknown; runId: string; methodRevisionId: string; aiRunId: string }>
    >`SELECT "body", "runId", "methodRevisionId", "aiRunId"
      FROM "ExperimentAiDraft"
      WHERE "experimentId" = ${experiment.id}::uuid AND "kind" = 'RUN_INTERPRETATION'`;
    expect(persisted).toMatchObject({
      body: interpretation,
      runId: run.id,
      methodRevisionId: run.methodRevisionId,
      aiRunId,
    });
  });
});
