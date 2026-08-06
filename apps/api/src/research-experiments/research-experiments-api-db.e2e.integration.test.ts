import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { ResearchProjectContextReader } from "@evaluation/projects";
import {
  AppliedLearningService,
  ExperimentQueryService,
  ExperimentService,
  ResearchDecisionService,
  ResearchEvidenceLinkService,
  ResearchProposalConfirmationService,
  ResearchQueryService,
  ResearchService,
} from "@evaluation/research-experiments";
import {
  ConfirmedResearchEvidenceReader,
  PrismaEvidenceScopeReader,
} from "@evaluation/updates-evidence";
import { ResearchWorkItemReader } from "@evaluation/work-items";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppErrorFilter } from "../platform/error.filter.js";
import { CorrelationMiddleware } from "../platform/correlation.middleware.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { ExperimentsController } from "./experiments.controller.js";
import { ResearchExperimentsPolicyGuard } from "./research-experiments-policy.guard.js";
import { ResearchRecordsController } from "./research-records.controller.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const ownerId = crypto.randomUUID();
const now = new Date("2026-08-06T14:00:00.000Z");
let projectId = "";
let evidenceId = "";
let evidenceRevisionId = "";
let app: import("@nestjs/common").INestApplication | undefined;
let baseUrl = "";

const authGuard = {
  canActivate(context: import("@nestjs/common").ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      principal?: unknown;
    }>();
    if (request.headers.authorization !== `Bearer ${ownerId}`) return false;
    request.principal = {
      userId: ownerId,
      active: true,
      email: "research-api-owner@example.invalid",
      oidcSubject: ownerId,
      roles: [],
    };
    return true;
  },
};

const workItems = new ResearchWorkItemReader(database);
const authorizer = new ResearchProjectContextReader(database, workItems);
const research = new ResearchService({
  database,
  authorizer,
  auditWriter: databaseAuditWriter as never,
  clock: () => now,
});
const researchQuery = new ResearchQueryService({ database, authorizer, clock: () => now });
const experiments = new ExperimentService({
  database,
  authorizer,
  auditWriter: databaseAuditWriter as never,
  clock: () => now,
});
const experimentQuery = new ExperimentQueryService({ database, authorizer, clock: () => now });
const decisions = new ResearchDecisionService({
  database,
  authorizer,
  auditWriter: databaseAuditWriter as never,
  clock: () => now,
});
const learning = new AppliedLearningService({
  database,
  authorizer,
  auditWriter: databaseAuditWriter as never,
  targetReaders: { research: researchQuery, experiment: experimentQuery },
  clock: () => now,
});
const evidence = new ResearchEvidenceLinkService({
  database,
  authorizer,
  auditWriter: databaseAuditWriter as never,
  evidenceReader: new ConfirmedResearchEvidenceReader(database, new PrismaEvidenceScopeReader()),
  clock: () => now,
});

class RealResearchApiModule {}
Module({
  controllers: [ResearchRecordsController, ExperimentsController],
  providers: [
    { provide: AuthGuard, useValue: authGuard },
    ResearchExperimentsPolicyGuard,
    { provide: ResearchService, useValue: research },
    { provide: ResearchQueryService, useValue: researchQuery },
    { provide: ExperimentService, useValue: experiments },
    { provide: ExperimentQueryService, useValue: experimentQuery },
    { provide: ResearchDecisionService, useValue: decisions },
    { provide: AppliedLearningService, useValue: learning },
    { provide: ResearchEvidenceLinkService, useValue: evidence },
    { provide: ResearchProposalConfirmationService, useValue: {} },
  ],
})(RealResearchApiModule);

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const organization = await database.organization.create({
    data: { key: `research-api-${suffix}`, name: "Research API E2E" },
  });
  const department = await database.department.create({
    data: {
      key: `research-api-department-${suffix}`,
      name: "Research API E2E",
      organizationId: organization.id,
    },
  });
  await database.authorizationScope.create({
    data: {
      key: `research-api-department-scope-${suffix}`,
      scopeType: "department",
      departmentId: department.id,
    },
  });
  await database.user.create({
    data: {
      id: ownerId,
      email: `research-api-owner-${suffix}@example.invalid`,
      displayName: "Research API owner",
    },
  });
  const scope = await database.authorizationScope.create({
    data: {
      key: `research-api-project-${suffix}`,
      scopeType: "project",
      departmentId: department.id,
    },
  });
  const project = await database.project.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      authorizationScopeId: scope.id,
      name: "Production Research API journey",
      description: "Real services and PostgreSQL behind the production controllers.",
      status: "active",
      createdById: ownerId,
      members: {
        create: {
          employeeId: ownerId,
          startsAt: new Date("2026-08-01T00:00:00.000Z"),
          reason: "E2E owner membership",
          createdById: ownerId,
        },
      },
    },
  });
  projectId = project.id;
  const evidenceRecord = await database.evidenceRecord.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      projectId,
      employeeId: ownerId,
      state: "confirmed",
      revisions: {
        create: {
          revision: 1,
          revisionKind: "manual_draft",
          sourceKind: "pasted_text",
          sourceText: "The bounded API experiment completed.",
          supportedClaim: "The result is reproducible under the stated conditions.",
          contributionContext: "Production API and database lifecycle integration.",
          executionMode: "manual",
          createdById: ownerId,
        },
      },
    },
    include: { revisions: true },
  });
  evidenceId = evidenceRecord.id;
  evidenceRevisionId = evidenceRecord.revisions[0]!.id;
  const evidenceConfirmation = await database.evidenceConfirmation.create({
    data: {
      evidenceId,
      evidenceRevisionId,
      employeeId: ownerId,
      reason: "Employee confirmed the E2E Evidence.",
      confirmedAt: now,
    },
  });
  await database.acceptedEvidenceEvent.create({
    data: {
      confirmationId: evidenceConfirmation.id,
      evidenceId,
      projectId,
      sourceReferences: [`evidence:${evidenceId}`],
      occurredAt: now,
    },
  });

  app = await NestFactory.create(RealResearchApiModule, { abortOnError: false, logger: false });
  app.useGlobalFilters(new AppErrorFilter());
  const correlation = new CorrelationMiddleware();
  app.use(correlation.use.bind(correlation));
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as import("node:net").AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await app?.close();
  await database.$disconnect();
});

describe("Research & Experiments real production API + PostgreSQL lifecycle", () => {
  it("persists source, two Experiments, decision, Evidence, and Applied Learning through controllers", async () => {
    const created = await api("POST", "/api/v1/research", researchInput());
    expect(created.response.status).toBe(201);
    const researchId = created.body.id as string;

    expect(
      (
        await api("POST", `/api/v1/research/${researchId}/transitions`, {
          expectedVersion: 1,
          state: "ACTIVE",
          reason: "Employee confirmed the Research question.",
          successorResearchId: null,
        })
      ).response.status,
    ).toBe(201);
    const source = await api("POST", `/api/v1/research/${researchId}/sources`, {
      expectedVersion: 2,
      source: { kind: "MANUAL_CITATION", canonicalUrl: "https://example.com/research" },
      kind: "PAPER",
      title: "Bounded source",
      relevanceNote: "Directly supports the stated Research question.",
      credibilityNote: "Employee-reviewed source for deterministic integration.",
      citedLocations: ["section:results"],
    });
    expect(source.response.status).toBe(201);
    const sourceReference = source.body.sourceReference as string;

    const first = await completeExperiment(researchId, "Supported API experiment", "SUPPORTED");
    const second = await completeExperiment(
      researchId,
      "Retained failed API experiment",
      "NOT_SUPPORTED",
      "FAILED",
    );

    const decision = await api("POST", `/api/v1/research/${researchId}/conclusions`, {
      expectedVersion: 3,
      synthesis: "The two retained outcomes support a bounded human decision.",
      answer: "Adopt only the supported bounded path.",
      remainingUncertainty: ["Production scale remains outside this test."],
      decision: "ADOPT",
      rationale: "The employee confirmed the named source and both Experiment outcomes.",
      nextAction: "Apply the bounded result.",
      sourceReferences: [sourceReference],
      experimentIds: [first.experimentId, second.experimentId],
    });
    expect(decision.response.status).toBe(201);
    const researchConclusionId = decision.body.id as string;

    const linked = await api("POST", `/api/v1/research/${researchId}/evidence-links`, {
      expectedVersion: 4,
      evidenceId,
      evidenceRevisionId,
      supportedClaim: "The supported Experiment is reproducible under the recorded conditions.",
      experimentId: first.experimentId,
      experimentRunId: first.runId,
      experimentConclusionId: first.conclusionId,
    });
    expect(linked.response.status, JSON.stringify(linked.body)).toBe(201);
    const applied = await api("POST", `/api/v1/research/${researchId}/applied-learning`, {
      expectedVersion: 5,
      researchConclusionId,
      target: { kind: "RESEARCH", id: researchId },
      whatChanged: "The Research record now carries the bounded implementation decision.",
      causalRationale: "The supported and failed outcomes narrowed the adopted path.",
    });
    expect(applied.response.status).toBe(201);

    const read = await api("GET", `/api/v1/research/${researchId}`);
    const firstRead = await api("GET", `/api/v1/experiments/${first.experimentId}`);
    expect(read.response.status).toBe(200);
    expect(firstRead.response.status).toBe(200);
    expect(read.body.detail).toMatchObject({ id: researchId, state: "CONCLUDED", version: 6 });
    expect(firstRead.body).toMatchObject({
      detail: { state: "CONCLUDED" },
      runs: [expect.objectContaining({ id: first.runId })],
      conclusions: [expect.objectContaining({ id: first.conclusionId, outcome: "SUPPORTED" })],
    });
    await expect(
      database.auditEvent.count({ where: { scopeId: projectId, targetType: "experiment" } }),
    ).resolves.toBeGreaterThanOrEqual(10);
  });
});

async function completeExperiment(
  researchId: string,
  title: string,
  outcome: "SUPPORTED" | "NOT_SUPPORTED",
  resultStatus: "COMPLETED" | "FAILED" = "COMPLETED",
) {
  const testCaseId = crypto.randomUUID();
  const created = await api("POST", `/api/v1/research/${researchId}/experiments`, {
    input: {
      researchId,
      scope: { projectId, workstreamId: null, workItemId: null },
      idempotencyKey: crypto.randomUUID(),
      title,
    },
    method: experimentMethod(testCaseId),
  });
  expect(created.response.status).toBe(201);
  const experimentId = created.body.id as string;
  const methodRevisionId = (created.body.currentMethod as Record<string, unknown>).id as string;
  for (const [expectedVersion, state] of [
    [1, "READY"],
    [2, "RUNNING"],
  ] as const) {
    const transition = await api("POST", `/api/v1/experiments/${experimentId}/transitions`, {
      expectedVersion,
      state,
      reason: null,
      successorExperimentId: null,
    });
    expect(transition.response.status).toBe(201);
  }
  const run = await api("POST", `/api/v1/experiments/${experimentId}/runs`, {
    expectedVersion: 3,
    methodRevisionId,
    startedAt: "2026-08-06T13:00:00.000Z",
    completedAt: "2026-08-06T13:10:00.000Z",
    resultStatus,
    environment: [{ name: "runtime", value: "test" }],
    inputs: [{ name: "fixture", value: "bounded" }],
    modelConfigurations: [],
    observations: [
      {
        measureStableId: "quality_result",
        testCaseId,
        observedValue: resultStatus === "COMPLETED" ? "pass" : "fail",
        unit: null,
        note: "Observed through the production API.",
      },
    ],
    unexpectedConditions: resultStatus === "FAILED" ? ["The retained run failed."] : [],
    executionNotes: "Executed by the real Experiment service.",
    sourceReferences: [],
  });
  expect(run.response.status).toBe(201);
  const runId = run.body.id as string;
  const conclusion = await api("POST", `/api/v1/experiments/${experimentId}/conclusions`, {
    input: {
      expectedVersion: 4,
      outcome,
      summary: `${title} produced a retained human-confirmed outcome.`,
      runIds: [runId],
      measureStableIds: ["quality_result"],
      limitations: ["This integration fixture is intentionally bounded."],
      confidenceDescription: "Sufficient for API lifecycle verification only.",
      decisionRelevance: "Supports the Research decision without assigning performance.",
      nextStep: "Retain the source-labelled outcome.",
    },
  });
  expect(conclusion.response.status).toBe(201);
  return { experimentId, runId, conclusionId: conclusion.body.id as string };
}

async function api(method: "GET" | "POST", path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${ownerId}`,
      "content-type": "application/json",
      "x-correlation-id": crypto.randomUUID(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { response, body: (await response.json()) as Record<string, unknown> };
}

function researchInput() {
  return {
    scope: { projectId, workstreamId: null, workItemId: null },
    idempotencyKey: crypto.randomUUID(),
    problemStatement: "The Project needs a source-supported technical decision.",
    context: "The production Research API must retain both supported and failed outcomes.",
    question: "Does the bounded approach satisfy the Project need?",
    objective: "Reach a documented human decision through the production API.",
    hypothesis: { kind: "TESTABLE", statement: "The bounded approach is reproducible." },
    assumptions: [],
    constraints: ["Do not infer employee performance."],
    knownUncertainty: ["Production scale is not measured here."],
    alternatives: ["Retain the current path."],
    decisionQuestion: "Should the bounded approach be adopted?",
    sourceReferences: [],
    executionMode: "manual",
  };
}

function experimentMethod(testCaseId: string) {
  return {
    question: "Does the bounded execution produce the expected result?",
    baseline: { description: "No verified execution", value: "unknown", sourceReference: null },
    measures: [
      {
        stableId: "quality_result",
        name: "Quality result",
        kind: "CATEGORICAL",
        unit: null,
        direction: "MATCH",
        baselineValue: "unknown",
        baselineReference: null,
        interpretationRule: "Compare the observed value with the expected result.",
      },
    ],
    testCases: [
      {
        id: testCaseId,
        inputIdentity: "bounded-production-api-fixture",
        expectedObservation: "Record pass or fail.",
        category: "integration",
        inclusionReason: "Exercises the production API and PostgreSQL lifecycle.",
      },
    ],
    controls: [{ comparisonTarget: "No verified execution", constantConditions: "Same fixture." }],
    conditions: ["Use the same deterministic fixture."],
    reproducibilityInstructions: "Repeat this request sequence against a migrated test database.",
    knownRisks: ["The fixture is not a production load test."],
    failureCases: ["The API or database rejects a valid lifecycle step."],
    sourceReferences: [],
    executionMode: "manual",
  };
}
