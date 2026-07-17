import { afterAll, describe, expect, it, vi } from "vitest";

import { createDatabaseClient } from "@evaluation/database";
import { CriteriaDocumentReader } from "@evaluation/documents";

import { ProposalService } from "./proposal-service.js";
import { WorkstreamReviewService } from "./workstream-review-service.js";

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
          ownerFeedbackSource: null,
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

  it("publishes a frozen workstream review, serializes a duplicate response race, and resolves preserved objections", async () => {
    const fixture = await seedProposalFixture("workstream");
    const identity = {
      kind: "workstream",
      resourceId: fixture.workstreamId!,
      projectId: fixture.projectId,
      organizationId: fixture.organizationId,
      departmentId: fixture.departmentId,
      primaryOwnerId: fixture.ownerId,
      contributorIds: [fixture.contributorBId, fixture.contributorAId],
    } as const;
    const audit = postgresAuditWriter();
    const outputReference = `criteria-proposal:${crypto.randomUUID()}`;
    const proposal = await createWorkstreamProposal(fixture, outputReference);
    const proposalId = String(proposal.id);
    const documentReader = new CriteriaDocumentReader(database);
    const reviewService = new WorkstreamReviewService(
      database,
      audit,
      { authorize: vi.fn(async () => true) },
      documentReader,
      { now: () => new Date() },
    );
    const concurrentDatabase = createDatabaseClient(testDatabaseUrl);
    const concurrentReviewService = new WorkstreamReviewService(
      concurrentDatabase,
      postgresAuditWriter(),
      { authorize: vi.fn(async () => true) },
      new CriteriaDocumentReader(concurrentDatabase),
      { now: () => new Date() },
    );
    const publishedAt = new Date();
    await database.$transaction((transaction) =>
      reviewService.publish(transaction, {
        proposal: proposal as unknown as Readonly<Record<string, unknown>>,
        identity,
        actorId: fixture.ownerId,
        reason: "Owner approved the workstream criteria for contributor review.",
        correlationId: crypto.randomUUID(),
        publishedAt,
      }),
    );

    await expect(
      database.criteriaReviewEligibility.findMany({
        where: { snapshot: { proposalId } },
        orderBy: { employeeId: "asc" },
        select: { employeeId: true, role: true, responseRequired: true },
      }),
    ).resolves.toEqual(
      [
        { employeeId: fixture.ownerId, role: "owner", responseRequired: false },
        {
          employeeId: fixture.contributorAId,
          role: "contributor",
          responseRequired: true,
        },
        {
          employeeId: fixture.contributorBId,
          role: "contributor",
          responseRequired: true,
        },
      ].sort((left, right) => left.employeeId.localeCompare(right.employeeId)),
    );

    const duplicateRace = await Promise.allSettled([
      reviewService.respond({
        actor: { userId: fixture.contributorAId, active: true },
        correlationId: crypto.randomUUID(),
        proposalId,
        response: { action: "acknowledge" },
      }),
      concurrentReviewService.respond({
        actor: { userId: fixture.contributorAId, active: true },
        correlationId: crypto.randomUUID(),
        proposalId,
        response: { action: "acknowledge" },
      }),
    ]);
    await concurrentDatabase.$disconnect();
    expect(duplicateRace.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(duplicateRace.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(duplicateRace.find((result) => result.status === "rejected")).toMatchObject({
      status: "rejected",
      reason: { code: "CRITERIA_RESPONSE_ALREADY_RECORDED" },
    });
    await expect(
      database.criteriaContributorResponse.count({
        where: { proposalId, employeeId: fixture.contributorAId },
      }),
    ).resolves.toBe(1);

    const completed = await reviewService.respond({
      actor: { userId: fixture.contributorBId, active: true },
      correlationId: crypto.randomUUID(),
      proposalId,
      response: { action: "object", reason: "Dependency is unresolved." },
    });
    expect(completed).toMatchObject({
      requiredResponses: 2,
      completedResponses: 2,
      objectionCount: 1,
      state: "manager_resolution",
    });
    const itemsBeforeResolution = await database.dynamicCriteriaProposalItem.findMany({
      where: { proposalId },
      orderBy: { position: "asc" },
    });
    const resolved = await reviewService.resolve({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      proposalId,
      resolution: {
        decision: "accept_with_objections",
        reason: "The objection is retained and accepted for the current criteria version.",
      },
    });
    expect(resolved).toMatchObject({ state: "approved", version: 4 });
    await expect(
      database.dynamicCriteriaProposalItem.findMany({
        where: { proposalId },
        orderBy: { position: "asc" },
      }),
    ).resolves.toEqual(itemsBeforeResolution);
    await expect(
      database.criteriaContributorResponse.findMany({
        where: { proposalId },
        orderBy: { employeeId: "asc" },
        select: { employeeId: true, response: true, reason: true },
      }),
    ).resolves.toEqual(
      [
        {
          employeeId: fixture.contributorAId,
          response: "acknowledge",
          reason: null,
        },
        {
          employeeId: fixture.contributorBId,
          response: "object",
          reason: "Dependency is unresolved.",
        },
      ].sort((left, right) => left.employeeId.localeCompare(right.employeeId)),
    );
    await expect(
      database.dynamicCriteriaProposalTransition.findMany({
        where: { proposalId },
        orderBy: { resultingVersion: "asc" },
        select: { fromState: true, toState: true, resultingVersion: true },
      }),
    ).resolves.toEqual([
      { fromState: "owner_review", toState: "contributor_review", resultingVersion: 2 },
      {
        fromState: "contributor_review",
        toState: "manager_resolution",
        resultingVersion: 3,
      },
      { fromState: "manager_resolution", toState: "approved", resultingVersion: 4 },
    ]);
  });

  it("rejects owner approval when a newer document version exists without changing review state", async () => {
    const fixture = await seedProposalFixture("workstream");
    const identity = {
      kind: "workstream",
      resourceId: fixture.workstreamId!,
      projectId: fixture.projectId,
      organizationId: fixture.organizationId,
      departmentId: fixture.departmentId,
      primaryOwnerId: fixture.ownerId,
      contributorIds: [fixture.contributorAId],
    } as const;
    const proposal = await createWorkstreamProposal(
      fixture,
      `criteria-proposal:${crypto.randomUUID()}`,
    );
    const proposalId = String(proposal.id);
    const document = await database.documentRecord.findUniqueOrThrow({
      where: { id: fixture.documentId },
      select: { templateVersionId: true },
    });
    await database.$transaction(async (transaction) => {
      await transaction.documentVersion.create({
        data: {
          documentId: fixture.documentId,
          version: 2,
          templateVersionId: document.templateVersionId,
          createdById: fixture.ownerId,
          reason: "Advance the workstream document after proposal generation.",
        },
      });
      await transaction.documentRecord.update({
        where: { id: fixture.documentId },
        data: { currentVersion: 2 },
      });
    });

    const documentReader = new CriteriaDocumentReader(database);
    const audit = postgresAuditWriter();
    const publisher = new WorkstreamReviewService(
      database,
      audit,
      { authorize: vi.fn(async () => true) },
      documentReader,
      { now: () => new Date() },
    );
    const proposalService = new ProposalService(
      database,
      documentReader,
      {
        snapshot: vi.fn(async () => identity),
        snapshotIn: vi.fn(async () => identity),
      },
      {} as never,
      {} as never,
      audit,
      { append: vi.fn() },
      publisher,
      { systemId: crypto.randomUUID(), timeoutMs: 1_000, now: () => new Date() },
    );

    await expect(
      proposalService.reviewByOwner({
        actor: { userId: fixture.ownerId, active: true },
        correlationId: crypto.randomUUID(),
        proposalId,
        review: {
          action: "approve",
          reason: "Attempt approval against the superseded source document.",
        },
      }),
    ).rejects.toMatchObject({ code: "CRITERIA_PREREQUISITES_INVALID" });
    await expect(
      database.dynamicCriteriaProposal.findUniqueOrThrow({
        where: { id: proposalId },
        select: { state: true, version: true, approvedAt: true },
      }),
    ).resolves.toEqual({ state: "owner_review", version: 1, approvedAt: null });
    await expect(database.criteriaReviewSnapshot.count({ where: { proposalId } })).resolves.toBe(0);
    await expect(
      database.criteriaReviewEligibility.count({
        where: { snapshot: { proposalId } },
      }),
    ).resolves.toBe(0);
    await expect(
      database.dynamicCriteriaProposalTransition.count({ where: { proposalId } }),
    ).resolves.toBe(0);
  });
});

async function createWorkstreamProposal(
  fixture: Awaited<ReturnType<typeof seedProposalFixture>>,
  outputReference: string,
) {
  if (fixture.workstreamId === null) throw new Error("Workstream fixture required");
  return database.$transaction(async (transaction) => {
    const created = await transaction.dynamicCriteriaProposal.create({
      data: {
        requestId: fixture.criteriaRequestId,
        kind: "workstream",
        projectId: null,
        workstreamId: fixture.workstreamId,
        sourceDocumentVersionId: fixture.documentVersionId,
        readinessCheckId: fixture.readinessCheckId,
        proposalNumber: 1,
        version: 1,
        state: "owner_review",
        outputReference,
        outputSchemaVersion: fixture.criteriaSchemaVersion,
        promptVersion: fixture.criteriaPromptVersion,
        promptHash: fixture.criteriaPromptHash,
        createdById: fixture.ownerId,
      },
    });
    const sourceReferences = JSON.stringify([`document-version:${fixture.documentVersionId}`]);
    await transaction.$executeRaw`
      INSERT INTO "DynamicCriteriaProposalItem" (
        "id", "proposalId", "position", "name", "selectionReason", "successLink",
        "expectedBehaviorOrResult", "evaluationMethod", "suggestedEvidence",
        "sourceReferences"
      ) VALUES
      (
        ${crypto.randomUUID()}::uuid, ${created.id}::uuid, 1, 'Integrated result',
        'Matches the documented success definition.', 'Definition of success',
        'The integrated output meets the acceptance condition.',
        'Review the documented acceptance result.', '["Acceptance record"]'::jsonb,
        ${sourceReferences}::jsonb
      ),
      (
        ${crypto.randomUUID()}::uuid, ${created.id}::uuid, 2, 'Dependency resolution',
        'Makes the documented dependency explicit.', 'Dependency outcome',
        'The dependency is resolved before delivery.',
        'Review the dependency decision record.', '["Dependency record"]'::jsonb,
        ${sourceReferences}::jsonb
      )
    `;
    await transaction.documentAnalysisRequest.update({
      where: { id: fixture.criteriaRequestId },
      data: {
        state: "succeeded",
        resultReference: outputReference,
        completedAt: new Date(),
      },
    });
    return created;
  });
}

async function seedProposalFixture(kind: "project" | "workstream" = "project") {
  const suffix = crypto.randomUUID();
  const owner = await database.user.create({
    data: {
      email: `criteria-owner-${suffix}@example.invalid`,
      displayName: "Criteria Owner",
    },
  });
  const contributorA = await database.user.create({
    data: {
      email: `criteria-contributor-a-${suffix}@example.invalid`,
      displayName: "Criteria Contributor A",
    },
  });
  const contributorB = await database.user.create({
    data: {
      email: `criteria-contributor-b-${suffix}@example.invalid`,
      displayName: "Criteria Contributor B",
    },
  });
  const manager = await database.user.create({
    data: {
      email: `criteria-manager-${suffix}@example.invalid`,
      displayName: "Criteria Manager",
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
  const workstreamId = kind === "workstream" ? crypto.randomUUID() : null;
  if (workstreamId !== null) {
    await database.authorizationScope.create({
      data: {
        id: workstreamId,
        key: `criteria-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId: department.id,
      },
    });
    await database.workstream.create({
      data: {
        id: workstreamId,
        projectId,
        authorizationScopeId: workstreamId,
        authorizationScopeType: "workstream",
        name: "Criteria Workstream",
        description: "Workstream review trigger fixture",
        status: "active",
        createdById: owner.id,
      },
    });
  }
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
  if (workstreamId !== null) {
    await database.responsibilityWindow.create({
      data: {
        employeeId: owner.id,
        workstreamId,
        responsibilityType: "original",
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        reason: "Initial owner",
        managerDecisionById: manager.id,
        managerDecisionAt: new Date("2026-07-01T00:00:00.000Z"),
        managerDecisionReason: "Initial workstream ownership",
        createdById: owner.id,
      },
    });
  }
  const template = await database.documentTemplate.create({
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
      ...(workstreamId === null ? { projectId } : { workstreamId }),
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
    kind === "project" ? "criteria.generate.project" : "criteria.generate.workstream",
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
      kind: kind === "project" ? "criteria_project" : "criteria_workstream",
      idempotencyKey: `criteria-request-${suffix}`,
      payloadHash: "4".repeat(64),
      routeKey: kind === "project" ? "criteria.generate.project" : "criteria.generate.workstream",
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
    contributorAId: contributorA.id,
    contributorBId: contributorB.id,
    managerId: manager.id,
    organizationId: organization.id,
    departmentId: department.id,
    projectId,
    workstreamId,
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
