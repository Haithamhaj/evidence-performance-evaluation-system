import { afterAll, describe, expect, it, vi } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

import { ProposalService } from "./proposal-service.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "";
const safeDatabase = /\/evaluation_phase1_test(?:\?|$)/u.test(testDatabaseUrl);
const database = createDatabaseClient(testDatabaseUrl);
const now = new Date("2026-07-17T12:00:00.000Z");

afterAll(async () => database.$disconnect());

describe.runIf(safeDatabase)("ProposalService PostgreSQL trigger protocol", () => {
  it("persists a proposal result and appends owner approval in trigger-required order", async () => {
    const fixture = await seedProposalFixture();
    const identity = {
      kind: "project",
      resourceId: fixture.projectId,
      projectId: fixture.projectId,
      organizationId: fixture.organizationId,
      departmentId: fixture.departmentId,
      primaryOwnerId: fixture.ownerId,
      contributorIds: [],
    } as const;
    const reviewReader = {
      snapshot: vi.fn(async () => identity),
      snapshotIn: vi.fn(async () => identity),
    };
    const audit = {
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
    const service = new ProposalService(
      database,
      {} as never,
      reviewReader,
      {} as never,
      {} as never,
      audit,
      { append: vi.fn() },
      { publish: vi.fn() } as never,
      { systemId: crypto.randomUUID(), timeoutMs: 1_000, now: () => now },
    );
    const outputReference = `criteria-proposal:${crypto.randomUUID()}`;
    const proposal = await database.$transaction((transaction) =>
      service.persistValidatedGeneration(
        transaction,
        {
          id: fixture.criteriaRequestId,
          kind: "project",
          routeKey: "criteria.generate.project",
          state: "running",
          operationId: fixture.criteriaOperationId,
          documentId: fixture.documentId,
          documentVersionId: fixture.documentVersionId,
          readinessCheckId: fixture.readinessCheckId,
          expectedDocumentVersion: 1,
          resourceId: fixture.projectId,
          projectId: fixture.projectId,
          organizationId: fixture.organizationId,
          departmentId: fixture.departmentId,
          ownerId: fixture.ownerId,
          contributorIds: [],
          promptArtifactId: fixture.criteriaPromptArtifactId,
          promptVersion: fixture.criteriaPromptVersion,
          promptHash: fixture.criteriaPromptHash,
          outputSchemaArtifactId: fixture.criteriaSchemaArtifactId,
          outputSchemaVersion: fixture.criteriaSchemaVersion,
          outputSchemaHash: fixture.criteriaSchemaHash,
          replacesProposalId: null,
          materialComparisonReviewId: null,
          ownerFeedback: null,
          createdById: fixture.ownerId,
          outputReference,
        },
        {
          criteria: [
            {
              name: "Integrated result",
              selectionReason: "Matches the documented success definition.",
              successLink: "Definition of success",
              expectedBehaviorOrResult: "The integrated output meets the acceptance condition.",
              evaluationMethod: "Review the documented acceptance result.",
              suggestedEvidence: ["Acceptance record"],
              sourceReferences: [`document-version:${fixture.documentVersionId}`],
            },
          ],
        },
      ),
    );
    expect(proposal).toMatchObject({ state: "owner_review", version: 1 });
    expect(
      await database.documentAnalysisRequest.findUniqueOrThrow({
        where: { id: fixture.criteriaRequestId },
        select: { state: true, resultReference: true },
      }),
    ).toEqual({ state: "succeeded", resultReference: outputReference });

    const approved = await service.reviewByOwner({
      actor: { userId: fixture.ownerId, active: true },
      correlationId: crypto.randomUUID(),
      proposalId: String(proposal.id),
      review: { action: "approve", reason: "The criteria reflect the project." },
    });
    expect(approved).toMatchObject({ state: "approved", version: 2 });
    await expect(
      database.dynamicCriteriaProposalTransition.findMany({
        where: { proposalId: String(proposal.id) },
        select: { fromState: true, toState: true, resultingVersion: true },
      }),
    ).resolves.toEqual([
      {
        fromState: "owner_review",
        toState: "approved",
        resultingVersion: 2,
      },
    ]);
  });
});

async function seedProposalFixture() {
  const suffix = crypto.randomUUID();
  const owner = await database.user.create({
    data: {
      email: `criteria-owner-${suffix}@example.invalid`,
      displayName: "Criteria Owner",
    },
  });
  const organization = await database.organization.create({
    data: { key: `criteria-org-${suffix}`, name: "Criteria Organization" },
  });
  const department = await database.department.create({
    data: {
      key: `criteria-department-${suffix}`,
      name: "Criteria Department",
      organizationId: organization.id,
    },
  });
  const projectId = crypto.randomUUID();
  await database.authorizationScope.create({
    data: {
      id: projectId,
      key: `criteria-project-${suffix}`,
      scopeType: "project",
      departmentId: department.id,
    },
  });
  await database.project.create({
    data: {
      id: projectId,
      organizationId: organization.id,
      departmentId: department.id,
      authorizationScopeId: projectId,
      authorizationScopeType: "project",
      name: "Criteria Project",
      description: "Proposal service trigger fixture",
      status: "active",
      createdById: owner.id,
    },
  });
  await database.responsibilityWindow.create({
    data: {
      employeeId: owner.id,
      projectId,
      responsibilityType: "original",
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      reason: "Initial owner",
      managerDecisionById: owner.id,
      managerDecisionAt: new Date("2026-07-01T00:00:00.000Z"),
      managerDecisionReason: "Initial project ownership",
      createdById: owner.id,
    },
  });
  const template = await database.documentTemplate.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      scopeType: "department",
      kind: "project",
      createdById: owner.id,
      versions: {
        create: {
          version: 1,
          status: "active",
          reason: "Criteria fixture",
          createdById: owner.id,
          activatedAt: now,
        },
      },
    },
    include: { versions: true },
  });
  const document = await database.documentRecord.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      projectId,
      templateVersionId: template.versions[0]!.id,
      currentVersion: 1,
      createdById: owner.id,
      versions: {
        create: {
          version: 1,
          templateVersionId: template.versions[0]!.id,
          reason: "Criteria fixture",
          createdById: owner.id,
        },
      },
    },
    include: { versions: true },
  });
  const readinessArtifacts = await createArtifacts(
    owner.id,
    "document.analyze",
    `readiness-${suffix}`,
  );
  const readinessOperation = await database.operation.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: organization.id,
      jobType: "document.readiness",
      jobVersion: 1,
      idempotencyKey: `readiness-operation-${suffix}`,
      correlationId: crypto.randomUUID(),
      payloadHash: "1".repeat(64),
    },
  });
  const readinessRequest = await database.documentAnalysisRequest.create({
    data: {
      kind: "readiness",
      idempotencyKey: `readiness-request-${suffix}`,
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
      operationId: readinessOperation.id,
      state: "running",
      startedAt: now,
    },
  });
  const readinessReference = `readiness-output:${crypto.randomUUID()}`;
  const readiness = await database.documentReadinessCheck.create({
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
          reason: "Ready fixture",
          effectiveAt: now,
        },
      },
    },
  });
  await database.documentAnalysisRequest.update({
    where: { id: readinessRequest.id },
    data: { state: "succeeded", resultReference: readinessReference, completedAt: now },
  });
  const criteriaArtifacts = await createArtifacts(
    owner.id,
    "criteria.generate.project",
    `criteria-${suffix}`,
  );
  const criteriaOperation = await database.operation.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: organization.id,
      jobType: "analysis-criteria.process",
      jobVersion: 1,
      idempotencyKey: `criteria-operation-${suffix}`,
      correlationId: crypto.randomUUID(),
      payloadHash: "3".repeat(64),
    },
  });
  const criteriaRequest = await database.documentAnalysisRequest.create({
    data: {
      kind: "criteria_project",
      idempotencyKey: `criteria-request-${suffix}`,
      payloadHash: "4".repeat(64),
      routeKey: "criteria.generate.project",
      documentId: document.id,
      currentDocumentVersionId: document.versions[0]!.id,
      pinnedReadinessCheckId: readiness.id,
      expectedAggregateVersion: 1,
      outputSchemaArtifactId: criteriaArtifacts.schema.id,
      outputSchemaVersion: criteriaArtifacts.schema.version,
      outputSchemaHash: criteriaArtifacts.schema.schemaHash,
      promptArtifactId: criteriaArtifacts.prompt.id,
      promptVersion: criteriaArtifacts.prompt.version,
      promptHash: criteriaArtifacts.prompt.bodyHash,
      operationId: criteriaOperation.id,
      state: "running",
      startedAt: now,
    },
  });
  return {
    ownerId: owner.id,
    organizationId: organization.id,
    departmentId: department.id,
    projectId,
    documentId: document.id,
    documentVersionId: document.versions[0]!.id,
    readinessCheckId: readiness.id,
    criteriaRequestId: criteriaRequest.id,
    criteriaOperationId: criteriaOperation.id,
    criteriaPromptArtifactId: criteriaArtifacts.prompt.id,
    criteriaPromptVersion: criteriaArtifacts.prompt.version,
    criteriaPromptHash: criteriaArtifacts.prompt.bodyHash,
    criteriaSchemaArtifactId: criteriaArtifacts.schema.id,
    criteriaSchemaVersion: criteriaArtifacts.schema.version,
    criteriaSchemaHash: criteriaArtifacts.schema.schemaHash,
  };
}

async function createArtifacts(actorId: string, routeKey: string, version: string) {
  const schema = await database.aiOutputSchemaArtifact.create({
    data: {
      routeKey,
      version: `${version}-output`,
      schemaHash: "a".repeat(64),
      schemaArtifact: { type: "object" },
      reason: "Proposal service PostgreSQL fixture",
      expectedBehavior: "Return source-bound output",
      evaluationEvidenceReferences: ["test:00000000-0000-4000-8000-000000000001"],
      humanApprovalPolicy: "feature_defined",
      createdById: actorId,
    },
  });
  const prompt = await database.analysisPromptArtifact.create({
    data: {
      routeKey,
      version: `${version}-prompt`,
      bodyHash: "b".repeat(64),
      trustedBody: "Trusted fixture instructions.",
      expectedBehavior: "Return source-bound output.",
      registeredById: actorId,
      registrationReason: "Proposal service PostgreSQL fixture",
    },
  });
  return { schema, prompt };
}
