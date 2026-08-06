import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { afterAll, describe, expect, it } from "vitest";

import { FinalizationService } from "./finalization-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-08-06T10:00:00Z");

afterAll(async () => client.$disconnect());

describe("FinalizationService", () => {
  it("transactionally freezes an idempotent human final judgment with selected citations and audit", async () => {
    const fixture = await finalizationFixture();
    const input = finalizationInput(fixture);
    const first = await fixture.service.finalize(input);

    await expect(fixture.service.finalize(input)).resolves.toEqual(first);
    expect(first).toMatchObject({
      assignmentId: fixture.assignment.id,
      cycleId: fixture.cycle.id,
      employeeId: fixture.employee.id,
      managerId: fixture.manager.id,
      cycleType: "CALIBRATION_NON_BASELINE",
      version: 1,
      closedAt: null,
    });
    expect(first.entries).toHaveLength(13);
    expect(first.entries[0]).toMatchObject({
      criterionId: fixture.items[0]!.id,
      rating: 4,
      managerInitialChangeReason: "Discussion clarified the cited result.",
      sourceReferences: [fixture.selfSourceId],
    });
    await expect(
      client.auditEvent.findFirstOrThrow({
        where: { eventType: "evaluation.finalized", targetId: first.id },
      }),
    ).resolves.toMatchObject({ effectiveSubjectId: fixture.employee.id });
    await expect(
      client.finalEvaluationSnapshot.update({
        where: { id: first.id },
        data: { finalComment: "Attempted historical edit." },
      }),
    ).rejects.toThrow(/append-only/i);
  });

  it("requires a reason for every change from the manager initial judgment and only accepts pinned sources", async () => {
    const fixture = await finalizationFixture();
    const entries = finalEntries(fixture);

    await expect(
      fixture.service.finalize({
        ...finalizationInput(fixture),
        idempotencyKey: crypto.randomUUID(),
        entries: [{ ...entries[0]!, managerInitialChangeReason: null }, ...entries.slice(1)],
      }),
    ).rejects.toMatchObject({ code: "EVALUATION_FINAL_CHANGE_REASON_REQUIRED" });
    await expect(
      fixture.service.finalize({
        ...finalizationInput(fixture),
        idempotencyKey: crypto.randomUUID(),
        entries: [{ ...entries[0]!, sourceReferences: [crypto.randomUUID()] }, ...entries.slice(1)],
      }),
    ).rejects.toMatchObject({ code: "EVALUATION_FINAL_SOURCE_NOT_AUTHORIZED" });
    await expect(
      fixture.service.finalize({
        ...finalizationInput(fixture),
        managerId: fixture.outsider.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE" });
  });

  it("rolls the snapshot and decisions back when audit append fails", async () => {
    const fixture = await finalizationFixture();
    const service = new FinalizationService(
      client,
      {
        append: async () => {
          throw new Error("audit unavailable");
        },
      },
      () => now,
    );

    await expect(service.finalize(finalizationInput(fixture))).rejects.toThrow("audit unavailable");
    await expect(
      client.finalEvaluationSnapshot.count({ where: { assignmentId: fixture.assignment.id } }),
    ).resolves.toBe(0);
    await expect(
      client.finalEvaluationDecision.count({ where: { assignmentId: fixture.assignment.id } }),
    ).resolves.toBe(0);
  });

  it("preserves an idempotent reservation without changing the final result or blocking closure", async () => {
    const fixture = await finalizationFixture();
    const finalized = await fixture.service.finalize(finalizationInput(fixture));
    const acknowledgmentStage = await client.employeeEvaluationCycle.update({
      where: { id: fixture.cycle.id },
      data: { state: "ACKNOWLEDGMENT", version: { increment: 1 } },
    });
    const acknowledgmentInput = {
      schemaVersion: 1 as const,
      assignmentId: fixture.assignment.id,
      actorId: fixture.employee.id,
      expectedVersion: 2,
      idempotencyKey: crypto.randomUUID(),
      kind: "ACKNOWLEDGED_WITH_RESERVATION" as const,
      reservation: "I acknowledge receipt but disagree with the first criterion judgment.",
    };
    const acknowledgment = await fixture.service.acknowledge(acknowledgmentInput);

    await expect(fixture.service.acknowledge(acknowledgmentInput)).resolves.toEqual(acknowledgment);
    expect(acknowledgment).toMatchObject({
      assignmentId: fixture.assignment.id,
      finalSnapshotId: finalized.id,
      kind: "ACKNOWLEDGED_WITH_RESERVATION",
    });
    await expect(
      client.finalEvaluationDecision.findMany({
        where: { snapshotId: finalized.id },
        orderBy: { position: "asc" },
      }),
    ).resolves.toMatchObject(finalized.entries.map((entry) => ({ rating: entry.rating })));

    const closeInput = {
      schemaVersion: 1 as const,
      cycleId: fixture.cycle.id,
      actorId: fixture.creator.id,
      expectedVersion: acknowledgmentStage.version,
      idempotencyKey: crypto.randomUUID(),
      reason: "All eligible assignments have final human judgments.",
    };
    const closed = await fixture.service.close(closeInput);
    await expect(fixture.service.close(closeInput)).resolves.toEqual(closed);
    expect(closed).toMatchObject({
      cycleId: fixture.cycle.id,
      state: "CLOSED",
      closedAt: now.toISOString(),
    });
    await expect(
      client.evaluationAcknowledgment.findUniqueOrThrow({
        where: { assignmentId: fixture.assignment.id },
      }),
    ).resolves.toMatchObject({ reservation: acknowledgmentInput.reservation });
  });
});

async function finalizationFixture() {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `finalization-${suffix}`, name: "Finalization Organization" },
  });
  const department = await client.department.create({
    data: {
      key: `finalization-department-${suffix}`,
      name: "Finalization Department",
      organizationId: organization.id,
    },
  });
  const [creator, employee, manager, outsider] = await Promise.all(
    ["creator", "employee", "manager", "outsider"].map((role) =>
      client.user.create({
        data: {
          email: `finalization-${role}-${suffix}@example.invalid`,
          displayName: `Finalization ${role}`,
        },
      }),
    ),
  );
  const rubricVersion = await client.rubricVersion.create({
    data: { organizationId: organization.id, version: `finalization-${suffix}` },
  });
  const template = await client.evaluationTemplate.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      scope: "DEPARTMENT",
      key: `finalization-template-${suffix}`,
      name: "Finalization Template",
      createdById: creator!.id,
    },
  });
  const templateVersion = await client.evaluationTemplateVersion.create({
    data: {
      templateId: template.id,
      rubricVersionId: rubricVersion.id,
      versionNumber: 1,
      status: "ACTIVE",
      ratingScale: [1, 2, 3, 4, 5],
      weightPolicy: { sectionTotal: 100 },
      evaluationPolicy: { cadence: "QUARTERLY" },
      localeAvailability: ["en"],
      version: 2,
      createdById: creator!.id,
      activatedById: creator!.id,
      activatedAt: now,
    },
  });
  const items = await Promise.all(
    Array.from({ length: 13 }, (_, position) =>
      client.evaluationTemplateItem.create({
        data: {
          versionId: templateVersion.id,
          stableCriterionId: position === 12 ? "PROJECT-CONTRIBUTION" : `CRITERION-${position + 1}`,
          kind: position === 12 ? "PROJECT_CONTRIBUTION" : "FIXED_CRITERION",
          sectionStableId: position === 12 ? "PROJECT" : "FIXED",
          sectionWeight: position === 12 ? 25 : 75,
          criterionWeight: position === 12 ? null : 8,
          displayOrder: position,
          mandatory: true,
        },
      }),
    ),
  );
  const eligibilityCycle = await client.evaluationCycle.create({
    data: {
      departmentId: department.id,
      managerId: manager!.id,
      version: 1,
      visibilityMode: "identified",
      sourceReason: "Finalization fixture.",
      effectiveFrom: new Date("2026-07-01T00:00:00Z"),
      effectiveTo: new Date("2026-10-01T00:00:00Z"),
    },
  });
  const eligibilitySnapshot = await client.eligibilitySnapshot.create({
    data: {
      cycleId: eligibilityCycle.id,
      version: 1,
      visibilityMode: "identified",
      sourceReason: "Finalization fixture.",
      effectiveFrom: new Date("2026-07-01T00:00:00Z"),
      effectiveTo: new Date("2026-10-01T00:00:00Z"),
    },
  });
  const cycle = await client.employeeEvaluationCycle.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      departmentId: department.id,
      templateVersionId: templateVersion.id,
      sequence: 1,
      cycleType: "CALIBRATION_NON_BASELINE",
      state: "FINALIZATION",
      visibilityMode: "identified",
      startsAt: new Date("2026-07-01T00:00:00Z"),
      endsAt: new Date("2026-10-01T00:00:00Z"),
      version: 6,
      createdById: creator!.id,
      openedAt: now,
      snapshot: {
        create: {
          templateVersionId: templateVersion.id,
          rubricVersionId: rubricVersion.id,
          eligibilitySnapshotId: eligibilitySnapshot.id,
          cycleType: "CALIBRATION_NON_BASELINE",
          visibilityMode: "identified",
          startsAt: new Date("2026-07-01T00:00:00Z"),
          endsAt: new Date("2026-10-01T00:00:00Z"),
          ratingScale: [1, 2, 3, 4, 5],
          templateSnapshot: {
            items: items.map((item) => ({
              id: item.id,
              stableCriterionId: item.stableCriterionId,
              kind: item.kind,
              mandatory: item.mandatory,
            })),
          },
          localeAvailability: ["en"],
          configurationVersions: { templateVersion: 1 },
        },
      },
      assignments: {
        create: {
          employeeId: employee!.id,
          managerId: manager!.id,
          eligibilityState: "ELIGIBLE",
          eligibilityReason: "Active at cycle opening.",
          eligibilityEffectiveAt: new Date("2026-07-01T00:00:00Z"),
        },
      },
    },
    include: { assignments: true, snapshot: true },
  });
  const assignment = cycle.assignments[0]!;
  const selfSourceId = crypto.randomUUID();
  const managerSourceId = crypto.randomUUID();
  await createSubmission(
    assignment.id,
    cycle.snapshot!.id,
    employee!.id,
    "SELF",
    items.map((item) => submissionEntry(item.id, 3, selfSourceId, null)),
  );
  await createSubmission(
    assignment.id,
    cycle.snapshot!.id,
    manager!.id,
    "MANAGER_INITIAL",
    items.map((item) =>
      submissionEntry(item.id, 3, managerSourceId, "Observed during the period."),
    ),
  );
  await client.evaluationDiscussionEntry.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      assignmentId: assignment.id,
      actorId: manager!.id,
      body: "The employee cited an additional result during discussion.",
      sourceReferences: [selfSourceId],
      resultingVersion: 1,
    },
  });
  return {
    assignment,
    cycle,
    creator: creator!,
    department,
    employee: employee!,
    items,
    manager: manager!,
    managerSourceId,
    outsider: outsider!,
    selfSourceId,
    service: new FinalizationService(client, databaseAuditWriter, () => now),
  };
}

async function createSubmission(
  assignmentId: string,
  cycleSnapshotId: string,
  actorId: string,
  kind: "SELF" | "MANAGER_INITIAL",
  entries: ReturnType<typeof submissionEntry>[],
) {
  const assessment = await client.assessment.create({ data: { assignmentId, kind, version: 2 } });
  const revision = await client.assessmentRevision.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      assessmentId: assessment.id,
      revision: 1,
      entries,
      createdById: actorId,
      createdAt: now,
    },
  });
  return client.assessmentSubmission.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      assignmentId,
      kind,
      assessmentId: assessment.id,
      revisionId: revision.id,
      cycleSnapshotId,
      submittedById: actorId,
      confirmedAt: now,
    },
  });
}

function submissionEntry(
  criterionId: string,
  rating: 1 | 2 | 3 | 4 | 5,
  sourceId: string,
  directObservationBasis: string | null,
) {
  return {
    criterionId,
    rating,
    justification: `Human assessment rationale for ${criterionId}.`,
    sourceReferences: [sourceId],
    directObservationBasis,
  };
}

function finalEntries(fixture: Awaited<ReturnType<typeof finalizationFixture>>) {
  return fixture.items.map((item, position) => ({
    criterionId: item.id,
    rating: (position === 0 ? 4 : 3) as 3 | 4,
    justification: `Manager final human judgment for ${item.stableCriterionId}.`,
    sourceReferences: position === 0 ? [fixture.selfSourceId] : [fixture.managerSourceId],
    managerInitialChangeReason: position === 0 ? "Discussion clarified the cited result." : null,
  }));
}

function finalizationInput(fixture: Awaited<ReturnType<typeof finalizationFixture>>) {
  return {
    schemaVersion: 1 as const,
    assignmentId: fixture.assignment.id,
    managerId: fixture.manager.id,
    expectedVersion: 1,
    idempotencyKey: crypto.randomUUID(),
    entries: finalEntries(fixture),
    finalComment: "Final ratings reflect the manager's human judgment after discussion.",
  };
}
