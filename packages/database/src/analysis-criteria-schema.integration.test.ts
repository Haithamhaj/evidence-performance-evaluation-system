import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

function databaseConstraint(error: unknown): boolean {
  if (
    error instanceof Error &&
    /immutable|constraint|transition|eligib|overlap|criteria|criterion|response|history|frozen|lineage|pins|scope/iu.test(
      error.message,
    )
  ) {
    return true;
  }
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && ["P2002", "P2003", "P2010", "P2014"].includes(String(error.code))) {
    return true;
  }
  if ("cause" in error) return databaseConstraint(error.cause);
  if ("meta" in error) return databaseConstraint(error.meta);
  return "driverAdapterError" in error && databaseConstraint(error.driverAdapterError);
}

afterAll(async () => client.$disconnect());

async function seedReadinessTransition() {
  const suffix = crypto.randomUUID();
  const schemaVersion = `document-readiness-output.v1-${suffix}`;
  const promptVersion = `document-readiness-prompt.v1-${suffix}`;
  const actor = await client.user.create({
    data: {
      email: `readiness-history-${suffix}@example.invalid`,
      displayName: "Readiness Actor",
    },
  });
  const organization = await client.organization.create({
    data: { key: `readiness-org-${suffix}`, name: "Readiness Organization" },
  });
  const department = await client.department.create({
    data: {
      key: `readiness-department-${suffix}`,
      name: "Readiness Department",
      organizationId: organization.id,
    },
  });
  const projectId = crypto.randomUUID();
  const workstreamId = crypto.randomUUID();
  await client.authorizationScope.createMany({
    data: [
      {
        id: projectId,
        key: `readiness-project-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
      {
        id: workstreamId,
        key: `readiness-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId: department.id,
      },
    ],
  });
  await client.project.create({
    data: {
      id: projectId,
      organizationId: organization.id,
      departmentId: department.id,
      authorizationScopeId: projectId,
      authorizationScopeType: "project",
      name: "Readiness Project",
      description: "Readiness schema fixture",
      status: "active",
      createdById: actor.id,
    },
  });
  await client.workstream.create({
    data: {
      id: workstreamId,
      projectId,
      authorizationScopeId: workstreamId,
      authorizationScopeType: "workstream",
      name: "Readiness Workstream",
      description: "Readiness schema fixture workstream",
      status: "active",
      createdById: actor.id,
    },
  });
  const template = await client.documentTemplate.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      scopeType: "department",
      kind: "project",
      createdById: actor.id,
      versions: {
        create: {
          version: 1,
          status: "active",
          reason: "Readiness fixture",
          createdById: actor.id,
          activatedAt: new Date(),
        },
      },
    },
    include: { versions: true },
  });
  const document = await client.documentRecord.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      projectId,
      templateVersionId: template.versions[0]!.id,
      currentVersion: 1,
      createdById: actor.id,
      versions: {
        create: {
          version: 1,
          templateVersionId: template.versions[0]!.id,
          reason: "Readiness fixture",
          createdById: actor.id,
        },
      },
    },
    include: { versions: true },
  });
  const schemaArtifact = await client.aiOutputSchemaArtifact.create({
    data: {
      routeKey: "document.analyze",
      version: schemaVersion,
      schemaHash: "b".repeat(64),
      schemaArtifact: { type: "object" },
      reason: "Readiness fixture",
      expectedBehavior: "Return readiness only",
      evaluationEvidenceReferences: ["test:00000000-0000-4000-8000-000000000001"],
      humanApprovalPolicy: "feature_defined",
      createdById: actor.id,
    },
  });
  const promptArtifact = await client.analysisPromptArtifact.create({
    data: {
      routeKey: "document.analyze",
      version: promptVersion,
      bodyHash: "c".repeat(64),
      trustedBody: "Trusted readiness instructions.",
      expectedBehavior: "Return source-bound readiness only.",
      registeredById: actor.id,
      registrationReason: "Readiness fixture",
    },
  });
  const operation = await client.operation.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: organization.id,
      jobType: "document.readiness",
      jobVersion: 1,
      idempotencyKey: `readiness-operation-${suffix}`,
      correlationId: crypto.randomUUID(),
      payloadHash: "d".repeat(64),
      status: "pending",
    },
  });
  const request = await client.documentAnalysisRequest.create({
    data: {
      kind: "readiness",
      idempotencyKey: `readiness-request-${suffix}`,
      payloadHash: "e".repeat(64),
      routeKey: "document.analyze",
      documentId: document.id,
      currentDocumentVersionId: document.versions[0]!.id,
      expectedAggregateVersion: 1,
      outputSchemaArtifactId: schemaArtifact.id,
      outputSchemaVersion: schemaArtifact.version,
      outputSchemaHash: schemaArtifact.schemaHash,
      promptArtifactId: promptArtifact.id,
      promptVersion: promptArtifact.version,
      promptHash: promptArtifact.bodyHash,
      operationId: operation.id,
    },
  });
  const startedAt = new Date();
  await client.documentAnalysisRequest.update({
    where: { id: request.id },
    data: { state: "running", startedAt },
  });
  const readiness = await client.documentReadinessCheck.create({
    data: {
      requestId: request.id,
      documentId: document.id,
      documentVersionId: document.versions[0]!.id,
      templateVersionId: template.versions[0]!.id,
      analyzedState: "ready_for_criteria_generation",
      managerState: "ready",
      extractionCoverage: "complete",
      output: { state: "ready_for_criteria_generation", sourceReferences: ["document:fixture"] },
      outputReference: `readiness-output:${crypto.randomUUID()}`,
      inputSchemaVersion: "document-readiness-input.v1",
      outputSchemaVersion: schemaVersion,
      promptVersion,
      promptHash: promptArtifact.bodyHash,
      validationOutcome: "valid",
      sourceReferences: ["document:fixture"],
      createdById: actor.id,
    },
  });
  const transition = await client.documentReadinessLifecycleTransition.create({
    data: {
      readinessCheckId: readiness.id,
      documentVersionId: document.versions[0]!.id,
      fromState: "draft",
      toState: "ready_for_criteria_generation",
      actorId: actor.id,
      reason: "Initial readiness result",
      effectiveAt: new Date(),
    },
  });
  await client.documentAnalysisRequest.update({
    where: { id: request.id },
    data: {
      state: "succeeded",
      resultReference: readiness.outputReference,
      completedAt: new Date(),
    },
  });
  return {
    actorId: actor.id,
    organizationId: organization.id,
    projectId,
    workstreamId,
    documentId: document.id,
    documentVersionId: document.versions[0]!.id,
    readinessCheckId: readiness.id,
    schemaArtifactId: schemaArtifact.id,
    schemaVersion,
    schemaHash: schemaArtifact.schemaHash,
    promptArtifactId: promptArtifact.id,
    promptVersion,
    promptHash: promptArtifact.bodyHash,
    transition,
  };
}

async function createApprovedProjectProposal(
  fixture: Awaited<ReturnType<typeof seedReadinessTransition>>,
  proposalNumber: number,
) {
  const artifactSuffix = crypto.randomUUID();
  const routeKey = "criteria.generate.project";
  const schemaVersion = `criteria-project-output.v1-${artifactSuffix}`;
  const promptVersion = `criteria-project-prompt.v1-${artifactSuffix}`;
  const schemaArtifact = await client.aiOutputSchemaArtifact.create({
    data: {
      routeKey,
      version: schemaVersion,
      schemaHash: "3".repeat(64),
      schemaArtifact: { type: "object" },
      reason: "Criteria fixture",
      expectedBehavior: "Return source-bound project criteria only",
      evaluationEvidenceReferences: ["test:00000000-0000-4000-8000-000000000001"],
      humanApprovalPolicy: "feature_defined",
      createdById: fixture.actorId,
    },
  });
  const promptArtifact = await client.analysisPromptArtifact.create({
    data: {
      routeKey,
      version: promptVersion,
      bodyHash: "4".repeat(64),
      trustedBody: "Trusted project criteria instructions.",
      expectedBehavior: "Return source-bound project criteria only.",
      registeredById: fixture.actorId,
      registrationReason: "Criteria fixture",
    },
  });
  const operation = await client.operation.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      jobType: "criteria.generate.project",
      jobVersion: 1,
      idempotencyKey: `criteria-operation-${crypto.randomUUID()}`,
      correlationId: crypto.randomUUID(),
      payloadHash: "1".repeat(64),
      status: "pending",
    },
  });
  const request = await client.documentAnalysisRequest.create({
    data: {
      kind: "criteria_project",
      idempotencyKey: `criteria-request-${crypto.randomUUID()}`,
      payloadHash: "2".repeat(64),
      routeKey,
      documentId: fixture.documentId,
      currentDocumentVersionId: fixture.documentVersionId,
      pinnedReadinessCheckId: fixture.readinessCheckId,
      expectedAggregateVersion: 1,
      outputSchemaArtifactId: schemaArtifact.id,
      outputSchemaVersion: schemaArtifact.version,
      outputSchemaHash: schemaArtifact.schemaHash,
      promptArtifactId: promptArtifact.id,
      promptVersion: promptArtifact.version,
      promptHash: promptArtifact.bodyHash,
      operationId: operation.id,
    },
  });
  await client.documentAnalysisRequest.update({
    where: { id: request.id },
    data: { state: "running", startedAt: new Date() },
  });
  const outputReference = `criteria-proposal:${crypto.randomUUID()}`;
  return client.$transaction(async (transaction) => {
    const proposal = await transaction.dynamicCriteriaProposal.create({
      data: {
        requestId: request.id,
        kind: "project",
        projectId: fixture.projectId,
        sourceDocumentVersionId: fixture.documentVersionId,
        readinessCheckId: fixture.readinessCheckId,
        proposalNumber,
        version: 1,
        state: "owner_review",
        outputReference,
        outputSchemaVersion: schemaVersion,
        promptVersion,
        promptHash: promptArtifact.bodyHash,
        createdById: fixture.actorId,
        items: {
          create: {
            position: 1,
            name: "Integrated result",
            selectionReason: "Matches the documented definition of success.",
            successLink: "Definition of success",
            expectedBehaviorOrResult: "The integrated output meets the accepted condition.",
            evaluationMethod: "Review the documented acceptance result.",
            suggestedEvidence: ["acceptance-record"],
            sourceReferences: ["document:fixture"],
          },
        },
      },
    });
    await transaction.documentAnalysisRequest.update({
      where: { id: request.id },
      data: { state: "succeeded", resultReference: outputReference, completedAt: new Date() },
    });
    await transaction.dynamicCriteriaProposalTransition.create({
      data: {
        proposalId: proposal.id,
        fromState: "owner_review",
        toState: "approved",
        actorId: fixture.actorId,
        reason: "Owner approved fixture criteria",
        resultingVersion: 2,
        createdAt: proposal.updatedAt,
      },
    });
    return transaction.dynamicCriteriaProposal.update({
      where: { id: proposal.id },
      data: { state: "approved", version: 2, approvedAt: new Date() },
    });
  });
}

async function createRunningCriteriaRequest(
  fixture: Awaited<ReturnType<typeof seedReadinessTransition>>,
  kind: "criteria_project" | "criteria_workstream",
) {
  const suffix = crypto.randomUUID();
  const routeKey =
    kind === "criteria_project" ? "criteria.generate.project" : "criteria.generate.workstream";
  const schemaArtifact = await client.aiOutputSchemaArtifact.create({
    data: {
      routeKey,
      version: `criteria-output.v1-${suffix}`,
      schemaHash: "5".repeat(64),
      schemaArtifact: { type: "object" },
      reason: "Criteria lineage fixture",
      expectedBehavior: "Return kind-matched source-bound criteria",
      evaluationEvidenceReferences: ["test:00000000-0000-4000-8000-000000000001"],
      humanApprovalPolicy: "feature_defined",
      createdById: fixture.actorId,
    },
  });
  const promptArtifact = await client.analysisPromptArtifact.create({
    data: {
      routeKey,
      version: `criteria-prompt.v1-${suffix}`,
      bodyHash: "6".repeat(64),
      trustedBody: "Trusted criteria lineage instructions.",
      expectedBehavior: "Return kind-matched source-bound criteria.",
      registeredById: fixture.actorId,
      registrationReason: "Criteria lineage fixture",
    },
  });
  const operation = await client.operation.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      jobType: routeKey,
      jobVersion: 1,
      idempotencyKey: `criteria-lineage-operation-${suffix}`,
      correlationId: crypto.randomUUID(),
      payloadHash: "7".repeat(64),
      status: "pending",
    },
  });
  const request = await client.documentAnalysisRequest.create({
    data: {
      kind,
      idempotencyKey: `criteria-lineage-request-${suffix}`,
      payloadHash: "8".repeat(64),
      routeKey,
      documentId: fixture.documentId,
      currentDocumentVersionId: fixture.documentVersionId,
      pinnedReadinessCheckId: fixture.readinessCheckId,
      expectedAggregateVersion: 1,
      outputSchemaArtifactId: schemaArtifact.id,
      outputSchemaVersion: schemaArtifact.version,
      outputSchemaHash: schemaArtifact.schemaHash,
      promptArtifactId: promptArtifact.id,
      promptVersion: promptArtifact.version,
      promptHash: promptArtifact.bodyHash,
      operationId: operation.id,
    },
  });
  await client.documentAnalysisRequest.update({
    where: { id: request.id },
    data: { state: "running", startedAt: new Date() },
  });
  return { request, schemaArtifact, promptArtifact };
}

async function createRunningReadinessRequest(
  fixture: Awaited<ReturnType<typeof seedReadinessTransition>>,
) {
  const suffix = crypto.randomUUID();
  const operation = await client.operation.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      jobType: "document.readiness",
      jobVersion: 1,
      idempotencyKey: `additional-readiness-operation-${suffix}`,
      correlationId: crypto.randomUUID(),
      payloadHash: "9".repeat(64),
      status: "pending",
    },
  });
  const request = await client.documentAnalysisRequest.create({
    data: {
      kind: "readiness",
      idempotencyKey: `additional-readiness-request-${suffix}`,
      payloadHash: "a".repeat(64),
      routeKey: "document.analyze",
      documentId: fixture.documentId,
      currentDocumentVersionId: fixture.documentVersionId,
      expectedAggregateVersion: 1,
      outputSchemaArtifactId: fixture.schemaArtifactId,
      outputSchemaVersion: fixture.schemaVersion,
      outputSchemaHash: fixture.schemaHash,
      promptArtifactId: fixture.promptArtifactId,
      promptVersion: fixture.promptVersion,
      promptHash: fixture.promptHash,
      operationId: operation.id,
    },
  });
  await client.documentAnalysisRequest.update({
    where: { id: request.id },
    data: { state: "running", startedAt: new Date() },
  });
  return request;
}

async function createAdditionalReadinessCheck(
  fixture: Awaited<ReturnType<typeof seedReadinessTransition>>,
) {
  const request = await createRunningReadinessRequest(fixture);
  const outputReference = `additional-readiness-output:${crypto.randomUUID()}`;
  const readinessCheck = await client.documentReadinessCheck.create({
    data: {
      requestId: request.id,
      documentId: fixture.documentId,
      documentVersionId: fixture.documentVersionId,
      templateVersionId: (
        await client.documentVersion.findUniqueOrThrow({
          where: { id: fixture.documentVersionId },
          select: { templateVersionId: true },
        })
      ).templateVersionId,
      analyzedState: "ready_for_criteria_generation",
      managerState: "ready",
      extractionCoverage: "complete",
      output: { state: "ready_for_criteria_generation", sourceReferences: ["document:fixture"] },
      outputReference,
      inputSchemaVersion: "document-readiness-input.v1",
      outputSchemaVersion: fixture.schemaVersion,
      promptVersion: fixture.promptVersion,
      promptHash: fixture.promptHash,
      validationOutcome: "valid",
      sourceReferences: ["document:fixture"],
      createdById: fixture.actorId,
    },
  });
  await client.documentAnalysisRequest.update({
    where: { id: request.id },
    data: { state: "succeeded", resultReference: outputReference, completedAt: new Date() },
  });
  return readinessCheck;
}

describe("analysis and criteria schema", () => {
  it("exposes immutable route-bound prompt artifacts", async () => {
    const artifactVersion = `document-comparison.v1-${crypto.randomUUID()}`;
    const actor = await client.user.create({
      data: {
        email: `analysis-prompt-${crypto.randomUUID()}@example.invalid`,
        displayName: "Prompt Actor",
      },
    });
    const artifact = await client.analysisPromptArtifact.create({
      data: {
        routeKey: "document.compare",
        version: artifactVersion,
        bodyHash: "a".repeat(64),
        trustedBody: "Trusted readiness instructions.",
        expectedBehavior: "Return source-bound readiness only.",
        registeredById: actor.id,
        registrationReason: "Bundle C test",
      },
    });

    await expect(
      client.analysisPromptArtifact.update({
        where: { id: artifact.id },
        data: { trustedBody: "Silently changed instructions." },
      }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.analysisPromptArtifact.delete({ where: { id: artifact.id } }),
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("rejects mutation of append-only readiness lifecycle history", async () => {
    const fixture = await seedReadinessTransition();
    await expect(
      client.documentReadinessLifecycleTransition.create({
        data: {
          readinessCheckId: fixture.readinessCheckId,
          documentVersionId: fixture.documentVersionId,
          fromState: "draft",
          toState: "criteria_approved",
          actorId: fixture.actorId,
          reason: "Skip the current lifecycle state",
          effectiveAt: new Date(),
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.documentReadinessLifecycleTransition.update({
        where: { id: fixture.transition.id },
        data: { reason: "Silent history rewrite" },
      }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.documentReadinessLifecycleTransition.delete({
        where: { id: fixture.transition.id },
      }),
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("rejects ineligible and duplicate frozen contributor responses", async () => {
    const fixture = await seedReadinessTransition();
    const proposal = await createApprovedProjectProposal(fixture, 1);
    const eligible = await client.user.create({
      data: {
        email: `eligible-${crypto.randomUUID()}@example.invalid`,
        displayName: "Eligible Contributor",
      },
    });
    const ineligible = await client.user.create({
      data: {
        email: `ineligible-${crypto.randomUUID()}@example.invalid`,
        displayName: "Ineligible Contributor",
      },
    });
    const snapshot = await client.criteriaReviewSnapshot.create({
      data: {
        proposalId: proposal.id,
        primaryOwnerId: fixture.actorId,
        responsibilityAt: new Date("2026-07-17T12:00:00.000Z"),
        publishedAt: new Date("2026-07-17T12:00:00.000Z"),
        eligibility: {
          create: {
            employeeId: eligible.id,
            role: "contributor",
            responseRequired: true,
          },
        },
      },
    });
    await expect(
      client.criteriaContributorResponse.create({
        data: {
          proposalId: proposal.id,
          snapshotId: snapshot.id,
          employeeId: ineligible.id,
          response: "acknowledge",
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.criteriaContributorResponse.create({
        data: {
          proposalId: proposal.id,
          snapshotId: snapshot.id,
          employeeId: eligible.id,
          response: "object",
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);
    await client.criteriaContributorResponse.create({
      data: {
        proposalId: proposal.id,
        snapshotId: snapshot.id,
        employeeId: eligible.id,
        response: "acknowledge",
      },
    });
    await expect(
      client.criteriaContributorResponse.create({
        data: {
          proposalId: proposal.id,
          snapshotId: snapshot.id,
          employeeId: eligible.id,
          response: "acknowledge",
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("rejects invalid set counts, overlapping periods, and unrecorded retirement", async () => {
    const fixture = await seedReadinessTransition();
    const firstProposal = await createApprovedProjectProposal(fixture, 1);
    const secondProposal = await createApprovedProjectProposal(fixture, 2);
    const approvedAt = new Date();
    const firstEffectiveFrom = new Date(approvedAt.getTime() + 60_000);
    const secondEffectiveFrom = new Date(approvedAt.getTime() + 120_000);

    await expect(
      client.$transaction(async (transaction) => {
        const set = await transaction.dynamicCriteriaSet.create({
          data: {
            kind: "project",
            projectId: fixture.projectId,
            version: 1,
            sourceDocumentVersionId: fixture.documentVersionId,
            proposalId: firstProposal.id,
            approvedAt,
            effectiveFrom: firstEffectiveFrom,
          },
        });
        await transaction.dynamicCriteriaSetTransition.create({
          data: {
            criteriaSetId: set.id,
            kind: "activated",
            effectiveAt: firstEffectiveFrom,
            actorId: fixture.actorId,
            reason: "Activate invalid-count fixture",
          },
        });
      }),
    ).rejects.toSatisfy(databaseConstraint);

    await expect(
      client.dynamicCriteriaSet.create({
        data: {
          kind: "project",
          projectId: fixture.projectId,
          version: 1,
          sourceDocumentVersionId: fixture.documentVersionId,
          proposalId: firstProposal.id,
          approvedAt,
          effectiveFrom: firstEffectiveFrom,
          criteria: {
            create: {
              position: 1,
              name: "Unactivated result",
              selectionReason: "Fixture must fail without an activation transition.",
              successLink: "Definition of success",
              expectedBehaviorOrResult: "The set cannot exist without activation history.",
              evaluationMethod: "Database invariant",
              suggestedEvidence: ["activation-record"],
              sourceReferences: ["document:fixture"],
            },
          },
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);

    const firstSet = await client.$transaction(async (transaction) => {
      const set = await transaction.dynamicCriteriaSet.create({
        data: {
          kind: "project",
          projectId: fixture.projectId,
          version: 1,
          sourceDocumentVersionId: fixture.documentVersionId,
          proposalId: firstProposal.id,
          approvedAt,
          effectiveFrom: firstEffectiveFrom,
          criteria: {
            create: {
              position: 1,
              name: "Integrated result",
              selectionReason: "Matches the documented definition of success.",
              successLink: "Definition of success",
              expectedBehaviorOrResult: "The integrated output meets the accepted condition.",
              evaluationMethod: "Review the documented acceptance result.",
              suggestedEvidence: ["acceptance-record"],
              sourceReferences: ["document:fixture"],
            },
          },
        },
      });
      await transaction.dynamicCriteriaSetTransition.create({
        data: {
          criteriaSetId: set.id,
          kind: "activated",
          effectiveAt: firstEffectiveFrom,
          actorId: fixture.actorId,
          reason: "Activate criteria fixture",
        },
      });
      return set;
    });
    await expect(
      client.dynamicCriterion.create({
        data: {
          criteriaSetId: firstSet.id,
          position: 2,
          name: "Late set criterion",
          selectionReason: "Must not be appended after activation.",
          successLink: "Definition of success",
          expectedBehaviorOrResult: "This row must be rejected.",
          evaluationMethod: "Database invariant",
          suggestedEvidence: ["late-row"],
          sourceReferences: ["document:fixture"],
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.$transaction(async (transaction) => {
        const set = await transaction.dynamicCriteriaSet.create({
          data: {
            kind: "project",
            projectId: fixture.projectId,
            version: 2,
            sourceDocumentVersionId: fixture.documentVersionId,
            proposalId: secondProposal.id,
            approvedAt,
            effectiveFrom: secondEffectiveFrom,
            criteria: {
              create: {
                position: 1,
                name: "Revised integrated result",
                selectionReason: "Matches the revised definition of success.",
                successLink: "Revised definition of success",
                expectedBehaviorOrResult: "The revised output meets the accepted condition.",
                evaluationMethod: "Review the revised acceptance result.",
                suggestedEvidence: ["revised-acceptance-record"],
                sourceReferences: ["document:fixture"],
              },
            },
          },
        });
        await transaction.dynamicCriteriaSetTransition.create({
          data: {
            criteriaSetId: set.id,
            kind: "activated",
            effectiveAt: secondEffectiveFrom,
            actorId: fixture.actorId,
            reason: "Activate overlapping fixture",
          },
        });
      }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.dynamicCriteriaSet.update({
        where: { id: firstSet.id },
        data: { effectiveTo: secondEffectiveFrom },
      }),
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("rejects proposal items and frozen eligibility added after the creation transaction", async () => {
    const fixture = await seedReadinessTransition();
    const proposal = await createApprovedProjectProposal(fixture, 1);
    await expect(
      client.dynamicCriteriaProposalItem.create({
        data: {
          proposalId: proposal.id,
          position: 2,
          name: "Late criterion",
          selectionReason: "Must not be appended after the proposal is frozen.",
          successLink: "Definition of success",
          expectedBehaviorOrResult: "This row must be rejected.",
          evaluationMethod: "Database invariant",
          suggestedEvidence: ["late-row"],
          sourceReferences: ["document:fixture"],
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);

    const contributor = await client.user.create({
      data: {
        email: `late-eligibility-${crypto.randomUUID()}@example.invalid`,
        displayName: "Late Contributor",
      },
    });
    const snapshot = await client.criteriaReviewSnapshot.create({
      data: {
        proposalId: proposal.id,
        primaryOwnerId: fixture.actorId,
        responsibilityAt: new Date(),
        publishedAt: new Date(),
      },
    });
    await expect(
      client.criteriaReviewEligibility.create({
        data: {
          snapshotId: snapshot.id,
          employeeId: contributor.id,
          role: "contributor",
          responseRequired: true,
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("rejects a response whose proposal does not match its frozen snapshot", async () => {
    const fixture = await seedReadinessTransition();
    const firstProposal = await createApprovedProjectProposal(fixture, 1);
    const secondProposal = await createApprovedProjectProposal(fixture, 2);
    const contributor = await client.user.create({
      data: {
        email: `snapshot-mismatch-${crypto.randomUUID()}@example.invalid`,
        displayName: "Snapshot Contributor",
      },
    });
    const snapshot = await client.criteriaReviewSnapshot.create({
      data: {
        proposalId: firstProposal.id,
        primaryOwnerId: fixture.actorId,
        responsibilityAt: new Date(),
        publishedAt: new Date(),
        eligibility: {
          create: {
            employeeId: contributor.id,
            role: "contributor",
            responseRequired: true,
          },
        },
      },
    });
    await expect(
      client.criteriaContributorResponse.create({
        data: {
          proposalId: secondProposal.id,
          snapshotId: snapshot.id,
          employeeId: contributor.id,
          response: "acknowledge",
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("rejects backdated and concurrent divergent readiness transitions", async () => {
    const fixture = await seedReadinessTransition();
    await expect(
      client.documentReadinessLifecycleTransition.create({
        data: {
          readinessCheckId: fixture.readinessCheckId,
          documentVersionId: fixture.documentVersionId,
          fromState: "ready_for_criteria_generation",
          toState: "revision_required",
          actorId: fixture.actorId,
          reason: "Backdated transition",
          effectiveAt: new Date(fixture.transition.effectiveAt.getTime() - 1),
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);

    const effectiveAt = new Date(fixture.transition.effectiveAt.getTime() + 1);
    const results = await Promise.allSettled([
      client.documentReadinessLifecycleTransition.create({
        data: {
          readinessCheckId: fixture.readinessCheckId,
          documentVersionId: fixture.documentVersionId,
          fromState: "ready_for_criteria_generation",
          toState: "revision_required",
          actorId: fixture.actorId,
          reason: "First concurrent transition",
          effectiveAt,
        },
      }),
      client.documentReadinessLifecycleTransition.create({
        data: {
          readinessCheckId: fixture.readinessCheckId,
          documentVersionId: fixture.documentVersionId,
          fromState: "ready_for_criteria_generation",
          toState: "superseded",
          actorId: fixture.actorId,
          reason: "Divergent concurrent transition",
          effectiveAt,
        },
      }),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
  });

  it("serializes readiness transitions across different checks for one document version", async () => {
    const fixture = await seedReadinessTransition();
    const additionalCheck = await createAdditionalReadinessCheck(fixture);
    const effectiveAt = new Date(fixture.transition.effectiveAt.getTime() + 1);
    let firstInserted: (() => void) | undefined;
    const firstInsertComplete = new Promise<void>((resolve) => {
      firstInserted = resolve;
    });
    const first = client.$transaction(async (transaction) => {
      const transition = await transaction.documentReadinessLifecycleTransition.create({
        data: {
          readinessCheckId: fixture.readinessCheckId,
          documentVersionId: fixture.documentVersionId,
          fromState: "ready_for_criteria_generation",
          toState: "revision_required",
          actorId: fixture.actorId,
          reason: "First aggregate transition",
          effectiveAt,
        },
      });
      firstInserted?.();
      await transaction.$queryRaw`SELECT 1 AS "held" FROM pg_sleep(0.25)`;
      return transition;
    });
    await firstInsertComplete;
    const second = client.documentReadinessLifecycleTransition.create({
      data: {
        readinessCheckId: additionalCheck.id,
        documentVersionId: fixture.documentVersionId,
        fromState: "ready_for_criteria_generation",
        toState: "superseded",
        actorId: fixture.actorId,
        reason: "Divergent aggregate transition",
        effectiveAt,
      },
    });
    const results = await Promise.allSettled([first, second]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
  });

  it("rejects forged AI result artifact pins and criteria resource scope", async () => {
    const fixture = await seedReadinessTransition();
    const readinessRequest = await createRunningReadinessRequest(fixture);
    await expect(
      client.documentReadinessCheck.create({
        data: {
          requestId: readinessRequest.id,
          documentId: fixture.documentId,
          documentVersionId: fixture.documentVersionId,
          templateVersionId: (
            await client.documentVersion.findUniqueOrThrow({
              where: { id: fixture.documentVersionId },
              select: { templateVersionId: true },
            })
          ).templateVersionId,
          analyzedState: "ready_for_criteria_generation",
          managerState: "ready",
          extractionCoverage: "complete",
          output: {},
          outputReference: `forged-readiness:${crypto.randomUUID()}`,
          inputSchemaVersion: "document-readiness-input.v1",
          outputSchemaVersion: `${fixture.schemaVersion}-forged`,
          promptVersion: fixture.promptVersion,
          promptHash: fixture.promptHash,
          validationOutcome: "valid",
          sourceReferences: [],
          createdById: fixture.actorId,
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);

    const firstVersion = await client.documentVersion.findUniqueOrThrow({
      where: { id: fixture.documentVersionId },
    });
    const secondVersion = await client.documentVersion.create({
      data: {
        documentId: fixture.documentId,
        version: 2,
        templateVersionId: firstVersion.templateVersionId,
        createdById: fixture.actorId,
        reason: "Comparison artifact-pin fixture",
      },
    });
    const comparisonSuffix = crypto.randomUUID();
    const comparisonSchema = await client.aiOutputSchemaArtifact.create({
      data: {
        routeKey: "document.compare",
        version: `comparison-output.v1-${comparisonSuffix}`,
        schemaHash: "d".repeat(64),
        schemaArtifact: { type: "object" },
        reason: "Comparison artifact-pin fixture",
        expectedBehavior: "Return source-bound material comparison",
        evaluationEvidenceReferences: ["test:00000000-0000-4000-8000-000000000001"],
        humanApprovalPolicy: "feature_defined",
        createdById: fixture.actorId,
      },
    });
    const comparisonPrompt = await client.analysisPromptArtifact.create({
      data: {
        routeKey: "document.compare",
        version: `comparison-prompt.v1-${comparisonSuffix}`,
        bodyHash: "e".repeat(64),
        trustedBody: "Trusted comparison instructions.",
        expectedBehavior: "Return source-bound material comparison.",
        registeredById: fixture.actorId,
        registrationReason: "Comparison artifact-pin fixture",
      },
    });
    const comparisonOperation = await client.operation.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: fixture.organizationId,
        jobType: "document.compare",
        jobVersion: 1,
        idempotencyKey: `comparison-operation-${comparisonSuffix}`,
        correlationId: crypto.randomUUID(),
        payloadHash: "f".repeat(64),
        status: "pending",
      },
    });
    const comparisonRequest = await client.documentAnalysisRequest.create({
      data: {
        kind: "comparison",
        idempotencyKey: `comparison-request-${comparisonSuffix}`,
        payloadHash: "0".repeat(64),
        routeKey: "document.compare",
        documentId: fixture.documentId,
        beforeVersionId: firstVersion.id,
        afterVersionId: secondVersion.id,
        expectedAggregateVersion: 2,
        outputSchemaArtifactId: comparisonSchema.id,
        outputSchemaVersion: comparisonSchema.version,
        outputSchemaHash: comparisonSchema.schemaHash,
        promptArtifactId: comparisonPrompt.id,
        promptVersion: comparisonPrompt.version,
        promptHash: comparisonPrompt.bodyHash,
        operationId: comparisonOperation.id,
      },
    });
    await client.documentAnalysisRequest.update({
      where: { id: comparisonRequest.id },
      data: { state: "running", startedAt: new Date() },
    });
    await expect(
      client.documentComparison.create({
        data: {
          requestId: comparisonRequest.id,
          documentId: fixture.documentId,
          beforeVersionId: firstVersion.id,
          afterVersionId: secondVersion.id,
          aiClassification: "editorial",
          output: {},
          outputReference: `forged-comparison:${crypto.randomUUID()}`,
          inputSchemaVersion: "document-comparison-input.v1",
          outputSchemaVersion: comparisonSchema.version,
          promptVersion: `${comparisonPrompt.version}-forged`,
          promptHash: comparisonPrompt.bodyHash,
          validationOutcome: "valid",
          sourceReferences: [],
          createdById: fixture.actorId,
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);

    const {
      request: forgedPinRequest,
      schemaArtifact: forgedPinSchema,
      promptArtifact: forgedPinPrompt,
    } = await createRunningCriteriaRequest(fixture, "criteria_project");
    await expect(
      client.dynamicCriteriaProposal.create({
        data: {
          requestId: forgedPinRequest.id,
          kind: "project",
          projectId: fixture.projectId,
          sourceDocumentVersionId: fixture.documentVersionId,
          readinessCheckId: fixture.readinessCheckId,
          proposalNumber: 1,
          version: 1,
          state: "owner_review",
          outputReference: `forged-pin:${crypto.randomUUID()}`,
          outputSchemaVersion: forgedPinSchema.version,
          promptVersion: forgedPinPrompt.version,
          promptHash: `${forgedPinPrompt.bodyHash}-forged`,
          createdById: fixture.actorId,
          items: {
            create: {
              position: 1,
              name: "Forged prompt criterion",
              selectionReason: "Forged artifact-pin fixture.",
              successLink: "Project success",
              expectedBehaviorOrResult: "Must be rejected.",
              evaluationMethod: "Database invariant",
              suggestedEvidence: ["fixture"],
              sourceReferences: ["document:fixture"],
            },
          },
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);

    const {
      request: forgedScopeRequest,
      schemaArtifact: forgedScopeSchema,
      promptArtifact: forgedScopePrompt,
    } = await createRunningCriteriaRequest(fixture, "criteria_workstream");
    await expect(
      client.dynamicCriteriaProposal.create({
        data: {
          requestId: forgedScopeRequest.id,
          kind: "workstream",
          workstreamId: fixture.workstreamId,
          sourceDocumentVersionId: fixture.documentVersionId,
          readinessCheckId: fixture.readinessCheckId,
          proposalNumber: 1,
          version: 1,
          state: "owner_review",
          outputReference: `forged-scope:${crypto.randomUUID()}`,
          outputSchemaVersion: forgedScopeSchema.version,
          promptVersion: forgedScopePrompt.version,
          promptHash: forgedScopePrompt.bodyHash,
          createdById: fixture.actorId,
          items: {
            create: [
              {
                position: 1,
                name: "First workstream criterion",
                selectionReason: "Forged scope fixture.",
                successLink: "Workstream success",
                expectedBehaviorOrResult: "Must be rejected.",
                evaluationMethod: "Database invariant",
                suggestedEvidence: ["fixture"],
                sourceReferences: ["document:fixture"],
              },
              {
                position: 2,
                name: "Second workstream criterion",
                selectionReason: "Forged scope fixture.",
                successLink: "Workstream success",
                expectedBehaviorOrResult: "Must be rejected.",
                evaluationMethod: "Database invariant",
                suggestedEvidence: ["fixture"],
                sourceReferences: ["document:fixture"],
              },
            ],
          },
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("rejects a pre-fabricated proposal transition without its parent update", async () => {
    const fixture = await seedReadinessTransition();
    const proposal = await createApprovedProjectProposal(fixture, 1);
    await expect(
      client.dynamicCriteriaProposalTransition.create({
        data: {
          proposalId: proposal.id,
          fromState: "approved",
          toState: "activated",
          actorId: fixture.actorId,
          reason: "Transition without parent mutation",
          resultingVersion: proposal.version + 1,
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("rejects a backdated proposal transition even with a matching parent update", async () => {
    const fixture = await seedReadinessTransition();
    const proposal = await createApprovedProjectProposal(fixture, 1);
    await expect(
      client.$transaction(async (transaction) => {
        await transaction.dynamicCriteriaProposalTransition.create({
          data: {
            proposalId: proposal.id,
            fromState: "approved",
            toState: "activated",
            actorId: fixture.actorId,
            reason: "Backdated transition",
            resultingVersion: proposal.version + 1,
            createdAt: new Date(proposal.updatedAt.getTime() - 1),
          },
        });
        await transaction.dynamicCriteriaProposal.update({
          where: { id: proposal.id },
          data: { state: "activated", version: proposal.version + 1 },
        });
      }),
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("rejects a backdated proposal transition in the parent creation transaction", async () => {
    const fixture = await seedReadinessTransition();
    const { request, schemaArtifact, promptArtifact } = await createRunningCriteriaRequest(
      fixture,
      "criteria_project",
    );
    const outputReference = `backdated-created-proposal:${crypto.randomUUID()}`;
    await expect(
      client.$transaction(async (transaction) => {
        const proposal = await transaction.dynamicCriteriaProposal.create({
          data: {
            requestId: request.id,
            kind: "project",
            projectId: fixture.projectId,
            sourceDocumentVersionId: fixture.documentVersionId,
            readinessCheckId: fixture.readinessCheckId,
            proposalNumber: 1,
            version: 1,
            state: "owner_review",
            outputReference,
            outputSchemaVersion: schemaArtifact.version,
            promptVersion: promptArtifact.version,
            promptHash: promptArtifact.bodyHash,
            createdById: fixture.actorId,
            items: {
              create: {
                position: 1,
                name: "Backdated transition criterion",
                selectionReason: "Transition time integrity fixture.",
                successLink: "Definition of success",
                expectedBehaviorOrResult: "Must be rejected.",
                evaluationMethod: "Database invariant",
                suggestedEvidence: ["fixture"],
                sourceReferences: ["document:fixture"],
              },
            },
          },
        });
        await transaction.documentAnalysisRequest.update({
          where: { id: request.id },
          data: { state: "succeeded", resultReference: outputReference, completedAt: new Date() },
        });
        await transaction.dynamicCriteriaProposalTransition.create({
          data: {
            proposalId: proposal.id,
            fromState: "owner_review",
            toState: "approved",
            actorId: fixture.actorId,
            reason: "Backdated inside construction transaction",
            resultingVersion: 2,
            createdAt: new Date(proposal.createdAt.getTime() - 1),
          },
        });
        await transaction.dynamicCriteriaProposal.update({
          where: { id: proposal.id },
          data: { state: "approved", version: 2, approvedAt: new Date() },
        });
      }),
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("rejects a criteria_project request yielding a workstream proposal", async () => {
    const fixture = await seedReadinessTransition();
    const { request, schemaArtifact, promptArtifact } = await createRunningCriteriaRequest(
      fixture,
      "criteria_project",
    );
    await expect(
      client.dynamicCriteriaProposal.create({
        data: {
          requestId: request.id,
          kind: "workstream",
          workstreamId: fixture.workstreamId,
          sourceDocumentVersionId: fixture.documentVersionId,
          readinessCheckId: fixture.readinessCheckId,
          proposalNumber: 1,
          version: 1,
          state: "owner_review",
          outputReference: `criteria-proposal:${crypto.randomUUID()}`,
          outputSchemaVersion: schemaArtifact.version,
          promptVersion: promptArtifact.version,
          promptHash: promptArtifact.bodyHash,
          createdById: fixture.actorId,
          items: {
            create: [
              {
                position: 1,
                name: "First workstream criterion",
                selectionReason: "Kind mismatch fixture.",
                successLink: "Workstream success",
                expectedBehaviorOrResult: "Must be rejected.",
                evaluationMethod: "Database invariant",
                suggestedEvidence: ["fixture"],
                sourceReferences: ["document:fixture"],
              },
              {
                position: 2,
                name: "Second workstream criterion",
                selectionReason: "Kind mismatch fixture.",
                successLink: "Workstream success",
                expectedBehaviorOrResult: "Must be rejected.",
                evaluationMethod: "Database invariant",
                suggestedEvidence: ["fixture"],
                sourceReferences: ["document:fixture"],
              },
            ],
          },
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("declares frozen response eligibility and active-set period protections", async () => {
    const responseEligibility = await client.$queryRaw<Array<{ definition: string }>>`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname = 'CriteriaContributorResponse_eligibility_fkey'
    `;
    expect(responseEligibility[0]?.definition).toContain(
      'FOREIGN KEY ("snapshotId", "employeeId", "responseRequired")',
    );
    expect(responseEligibility[0]?.definition).toContain(
      'REFERENCES "CriteriaReviewEligibility"("snapshotId", "employeeId", "responseRequired")',
    );

    const activeSetExclusions = await client.$queryRaw<Array<{ constraintName: string }>>`
      SELECT conname AS "constraintName"
      FROM pg_constraint
      WHERE conname IN (
        'DynamicCriteriaSet_project_period_excl',
        'DynamicCriteriaSet_workstream_period_excl'
      )
      ORDER BY conname
    `;
    expect(activeSetExclusions).toHaveLength(2);
  });

  it("declares exact deferred criteria-count checks and legal lifecycle guards", async () => {
    const triggers = await client.$queryRaw<Array<{ triggerName: string }>>`
      SELECT tgname AS "triggerName"
      FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname IN (
          'DynamicCriteriaProposal_count_constraint',
          'DynamicCriteriaSet_count_constraint',
          'DocumentReadinessLifecycleTransition_validate',
          'DynamicCriteriaProposal_guard_update',
          'DynamicCriteriaSet_guard_update'
        )
      ORDER BY tgname
    `;
    expect(triggers.map(({ triggerName }) => triggerName)).toEqual([
      "DocumentReadinessLifecycleTransition_validate",
      "DynamicCriteriaProposal_count_constraint",
      "DynamicCriteriaProposal_guard_update",
      "DynamicCriteriaSet_count_constraint",
      "DynamicCriteriaSet_guard_update",
    ]);
  });
});
