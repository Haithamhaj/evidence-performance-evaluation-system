import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ConfirmedResearchEvidenceReader } from "./research-support-reader.js";
import { PrismaEvidenceScopeReader } from "./scope-readers.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const at = new Date("2026-08-05T09:00:00.000Z");
const ownerId = crypto.randomUUID();
const participantId = crypto.randomUUID();
const outsiderId = crypto.randomUUID();
const workstreamOnlyId = crypto.randomUUID();
const inactivePersistedId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const otherProjectId = crypto.randomUUID();
const workstreamId = crypto.randomUUID();
const confirmedEvidenceId = crypto.randomUUID();
const workstreamEvidenceId = crypto.randomUUID();
const privateDraftEvidenceId = crypto.randomUUID();

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `research-support-${suffix}`, name: "Research Support" },
  });
  const department = await client.department.create({
    data: {
      key: `research-support-${suffix}`,
      name: "Research Support",
      organizationId: organization.id,
    },
  });
  await client.user.createMany({
    data: [
      {
        id: ownerId,
        email: `research-support-owner-${suffix}@example.invalid`,
        displayName: "Evidence Owner",
      },
      {
        id: participantId,
        email: `research-support-participant-${suffix}@example.invalid`,
        displayName: "Project Participant",
      },
      {
        id: outsiderId,
        email: `research-support-outsider-${suffix}@example.invalid`,
        displayName: "Outsider",
      },
      {
        id: workstreamOnlyId,
        email: `research-support-workstream-${suffix}@example.invalid`,
        displayName: "Workstream-only participant",
      },
      {
        id: inactivePersistedId,
        email: `research-support-inactive-${suffix}@example.invalid`,
        displayName: "Inactive persisted participant",
        active: false,
      },
    ],
  });
  await client.authorizationScope.createMany({
    data: [
      {
        id: department.id,
        key: `research-support-department-${suffix}`,
        scopeType: "department",
        departmentId: department.id,
      },
      {
        id: projectId,
        key: `research-support-project-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
      {
        id: otherProjectId,
        key: `research-support-other-project-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
      {
        id: workstreamId,
        key: `research-support-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId: department.id,
      },
    ],
  });
  await client.project.createMany({
    data: [
      {
        id: projectId,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: projectId,
        name: "Evidence Project",
        description: "Authorized shared support",
        status: "active",
        createdById: ownerId,
      },
      {
        id: otherProjectId,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: otherProjectId,
        name: "Other Evidence Project",
        description: "Cross scope",
        status: "active",
        createdById: ownerId,
      },
    ],
  });
  await client.projectMember.createMany({
    data: [ownerId, participantId, inactivePersistedId].map((employeeId) => ({
      projectId,
      employeeId,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      reason: "Current Project participant",
      createdById: ownerId,
    })),
  });
  await client.workstream.create({
    data: {
      id: workstreamId,
      projectId,
      authorizationScopeId: workstreamId,
      name: "Evidence Workstream",
      description: "Exact Workstream scope",
      status: "active",
      createdById: ownerId,
    },
  });
  await client.workstreamMember.create({
    data: {
      workstreamId,
      employeeId: workstreamOnlyId,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      reason: "Current exact Workstream participant",
      createdById: ownerId,
    },
  });

  const confirmed = await client.evidenceRecord.create({
    data: {
      id: confirmedEvidenceId,
      idempotencyKey: crypto.randomUUID(),
      projectId,
      employeeId: ownerId,
      state: "confirmed",
      revisions: {
        create: {
          revision: 1,
          revisionKind: "manual_draft",
          sourceKind: "pasted_text",
          sourceText: "Shared source fact",
          supportedClaim: "The bounded retrieval rejected a private-network target.",
          contributionContext: "PRIVATE NARRATIVE MUST NOT LEAK",
          executionMode: "manual",
          createdById: ownerId,
        },
      },
    },
    include: { revisions: true },
  });
  const confirmedRevision = confirmed.revisions[0]!;
  const confirmation = await client.evidenceConfirmation.create({
    data: {
      evidenceId: confirmedEvidenceId,
      evidenceRevisionId: confirmedRevision.id,
      employeeId: ownerId,
      reason: "Employee confirmed shared Evidence",
      confirmedAt: at,
    },
  });
  await client.acceptedEvidenceEvent.create({
    data: {
      confirmationId: confirmation.id,
      evidenceId: confirmedEvidenceId,
      projectId,
      sourceReferences: [`evidence:${confirmedEvidenceId}`],
      occurredAt: at,
    },
  });
  const workstreamEvidence = await client.evidenceRecord.create({
    data: {
      id: workstreamEvidenceId,
      idempotencyKey: crypto.randomUUID(),
      projectId,
      workstreamId,
      employeeId: ownerId,
      state: "confirmed",
      revisions: {
        create: {
          revision: 1,
          revisionKind: "manual_draft",
          sourceKind: "pasted_text",
          sourceText: "Workstream shared source fact",
          supportedClaim: "The Workstream experiment completed its bounded validation.",
          contributionContext: "PRIVATE WORKSTREAM NARRATIVE MUST NOT LEAK",
          executionMode: "manual",
          createdById: ownerId,
        },
      },
    },
    include: { revisions: true },
  });
  const workstreamConfirmation = await client.evidenceConfirmation.create({
    data: {
      evidenceId: workstreamEvidenceId,
      evidenceRevisionId: workstreamEvidence.revisions[0]!.id,
      employeeId: ownerId,
      reason: "Employee confirmed shared Workstream Evidence",
      confirmedAt: at,
    },
  });
  await client.acceptedEvidenceEvent.create({
    data: {
      confirmationId: workstreamConfirmation.id,
      evidenceId: workstreamEvidenceId,
      projectId,
      workstreamId,
      sourceReferences: [`evidence:${workstreamEvidenceId}`],
      occurredAt: at,
    },
  });
  await client.evidenceRecord.create({
    data: {
      id: privateDraftEvidenceId,
      idempotencyKey: crypto.randomUUID(),
      projectId,
      employeeId: ownerId,
      state: "draft",
      revisions: {
        create: {
          revision: 1,
          revisionKind: "manual_draft",
          sourceKind: "pasted_text",
          sourceText: "Private draft",
          supportedClaim: "Unconfirmed claim",
          contributionContext: "Private draft narrative",
          executionMode: "manual",
          createdById: ownerId,
        },
      },
    },
  });
});

afterAll(async () => client.$disconnect());

describe("ConfirmedResearchEvidenceReader", () => {
  const reader = new ConfirmedResearchEvidenceReader(
    client,
    new PrismaEvidenceScopeReader(),
    () => at,
  );

  it("returns only confirmed shared Evidence fields to an authorized Project participant", async () => {
    const evidence = await reader.getConfirmedEvidence({
      actor: { userId: participantId, active: true },
      evidenceId: confirmedEvidenceId,
      projectId,
    });

    expect(evidence).toEqual({
      evidenceId: confirmedEvidenceId,
      evidenceRevisionId: expect.any(String),
      evidenceRevision: 1,
      projectId,
      workstreamId: null,
      workItemId: null,
      sourceKind: "pasted_text",
      supportedClaim: "The bounded retrieval rejected a private-network target.",
      confirmedAt: at.toISOString(),
      sourceReferences: [`evidence:${confirmedEvidenceId}`],
    });
    expect(JSON.stringify(evidence)).not.toMatch(
      /private narrative|contributionContext|rating|readinessPercent/iu,
    );
  });

  it("rejects private unconfirmed Evidence, cross-Project requests, and unrelated actors", async () => {
    await expect(
      reader.getConfirmedEvidence({
        actor: { userId: ownerId, active: true },
        evidenceId: privateDraftEvidenceId,
        projectId,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_EVIDENCE_NOT_CONFIRMED" });
    await expect(
      reader.getConfirmedEvidence({
        actor: { userId: participantId, active: true },
        evidenceId: confirmedEvidenceId,
        projectId: otherProjectId,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_EVIDENCE_NOT_CONFIRMED" });
    await expect(
      reader.getConfirmedEvidence({
        actor: { userId: outsiderId, active: true },
        evidenceId: confirmedEvidenceId,
        projectId,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SCOPE_FORBIDDEN" });
  });

  it("revalidates persisted active state even when the actor claim says active", async () => {
    await expect(
      reader.getConfirmedEvidence({
        actor: { userId: inactivePersistedId, active: true },
        evidenceId: confirmedEvidenceId,
        projectId,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SCOPE_FORBIDDEN" });
  });

  it("allows a Workstream-only contributor only for confirmed Evidence in that exact Workstream", async () => {
    await expect(
      reader.getConfirmedEvidence({
        actor: { userId: workstreamOnlyId, active: true },
        evidenceId: workstreamEvidenceId,
        projectId,
      }),
    ).resolves.toMatchObject({
      evidenceId: workstreamEvidenceId,
      projectId,
      workstreamId,
      supportedClaim: "The Workstream experiment completed its bounded validation.",
    });
    await expect(
      reader.getConfirmedEvidence({
        actor: { userId: workstreamOnlyId, active: true },
        evidenceId: confirmedEvidenceId,
        projectId,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SCOPE_FORBIDDEN" });
  });
});
