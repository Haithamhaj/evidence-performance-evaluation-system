import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { approvedEnglishRubric } from "@evaluation/localization";
import { afterAll, describe, expect, it } from "vitest";

import { AssessmentService } from "./assessment-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-08-06T10:00:00Z");

afterAll(async () => client.$disconnect());

async function fixture() {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `assessment-${suffix}`, name: "Assessment Organization" },
  });
  const department = await client.department.create({
    data: {
      key: `assessment-department-${suffix}`,
      name: "Assessment Department",
      organizationId: organization.id,
    },
  });
  const [actor, employee, manager, outsider] = await Promise.all([
    client.user.create({
      data: { email: `assessment-actor-${suffix}@example.invalid`, displayName: "Actor" },
    }),
    client.user.create({
      data: { email: `assessment-employee-${suffix}@example.invalid`, displayName: "Employee" },
    }),
    client.user.create({
      data: { email: `assessment-manager-${suffix}@example.invalid`, displayName: "Manager" },
    }),
    client.user.create({
      data: { email: `assessment-outsider-${suffix}@example.invalid`, displayName: "Outsider" },
    }),
  ]);
  const rubricVersion = await client.rubricVersion.create({
    data: { organizationId: organization.id, version: approvedEnglishRubric.version },
  });
  const template = await client.evaluationTemplate.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      scope: "DEPARTMENT",
      key: `assessment-template-${suffix}`,
      name: "Assessment Template",
      createdById: actor.id,
    },
  });
  const templateVersion = await client.evaluationTemplateVersion.create({
    data: {
      templateId: template.id,
      rubricVersionId: rubricVersion.id,
      versionNumber: 1,
      status: "ACTIVE",
      ratingScale: [1, 2, 3, 4, 5],
      weightPolicy: { sectionTotal: 100, fixedCriterionTotalPerSection: 100 },
      evaluationPolicy: { cadence: "QUARTERLY", cycleOneType: "CALIBRATION_NON_BASELINE" },
      localeAvailability: ["en"],
      version: 2,
      createdById: actor.id,
      activatedById: actor.id,
      activatedAt: now,
    },
  });
  const sections = new Map(approvedEnglishRubric.sections.map((section) => [section.id, section]));
  const sourceCriteria = [
    ...approvedEnglishRubric.employeeCriteria,
    approvedEnglishRubric.projectContribution,
  ];
  const items = [];
  for (const [displayOrder, criterion] of sourceCriteria.entries()) {
    const section = sections.get(criterion.sectionId)!;
    const item = await client.evaluationTemplateItem.create({
      data: {
        versionId: templateVersion.id,
        stableCriterionId: criterion.id,
        kind: criterion.id === "PROJECT-CONTRIBUTION" ? "PROJECT_CONTRIBUTION" : "FIXED_CRITERION",
        sectionStableId: section.id,
        sectionWeight: section.weight,
        criterionWeight: criterion.internalWeight ?? null,
        displayOrder,
        mandatory: true,
      },
    });
    const locale = await client.evaluationTemplateItemLocale.create({
      data: {
        itemId: item.id,
        locale: "en",
        title: criterion.title,
        definition: criterion.definition ?? criterion.purpose ?? criterion.title,
        anchors: criterion.anchors,
        examples: criterion.examples,
        evidenceGuidance:
          criterion.evidenceGuidance === undefined ? [] : [criterion.evidenceGuidance],
      },
    });
    items.push({ ...item, locales: [locale] });
  }

  const eligibilityCycle = await client.evaluationCycle.create({
    data: {
      departmentId: department.id,
      managerId: manager.id,
      version: 1,
      visibilityMode: "identified",
      sourceReason: "Assessment integration fixture.",
      effectiveFrom: new Date("2026-07-01T00:00:00Z"),
      effectiveTo: new Date("2026-10-01T00:00:00Z"),
    },
  });
  const eligibilitySnapshot = await client.eligibilitySnapshot.create({
    data: {
      cycleId: eligibilityCycle.id,
      version: 1,
      visibilityMode: "identified",
      sourceReason: "Assessment integration fixture.",
      effectiveFrom: new Date("2026-07-01T00:00:00Z"),
      effectiveTo: new Date("2026-10-01T00:00:00Z"),
    },
  });
  await client.evaluationCycle.update({
    where: { id: eligibilityCycle.id },
    data: { openedAt: now },
  });
  const cycle = await client.employeeEvaluationCycle.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      departmentId: department.id,
      templateVersionId: templateVersion.id,
      sequence: 1,
      cycleType: "CALIBRATION_NON_BASELINE",
      state: "SELF_ASSESSMENT",
      visibilityMode: "identified",
      startsAt: new Date("2026-07-01T00:00:00Z"),
      endsAt: new Date("2026-10-01T00:00:00Z"),
      version: 2,
      createdById: actor.id,
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
          localeAvailability: ["en"],
          configurationVersions: { templateVersion: 1 },
          templateSnapshot: {
            id: templateVersion.id,
            items: items.map((item) => ({
              id: item.id,
              stableCriterionId: item.stableCriterionId,
              kind: item.kind,
              mandatory: item.mandatory,
              locales: item.locales.map((locale) => ({
                locale: locale.locale,
                anchors: locale.anchors,
              })),
            })),
          },
        },
      },
      assignments: {
        create: {
          employeeId: employee.id,
          managerId: manager.id,
          eligibilityState: "ELIGIBLE",
          eligibilityReason: "Active at frozen cycle opening.",
          eligibilityEffectiveAt: new Date("2026-07-01T00:00:00Z"),
        },
      },
    },
    include: { assignments: true, snapshot: true },
  });
  const assignment = cycle.assignments[0]!;
  const selectedFactId = crypto.randomUUID();
  const alternateFactId = crypto.randomUUID();
  const factView = evaluationFactView(
    cycle.id,
    employee.id,
    rubricVersion.id,
    selectedFactId,
    alternateFactId,
  );
  const factViewReader: import("./assessment-service.js").AssessmentFactViewReader = {
    read: async () => factView,
  };
  const service = new AssessmentService(client, factViewReader, databaseAuditWriter, () => now);
  const selfEntries = completeEntries(items, selectedFactId, "SELF");
  const managerEntries = completeEntries(items, alternateFactId, "MANAGER_INITIAL");
  return {
    assignment,
    client,
    cycle,
    employee,
    factView,
    items,
    manager,
    managerEntries,
    outsider,
    selectedFactId,
    selfEntries,
    service,
  };
}

describe("AssessmentService", () => {
  it("appends draft revisions and returns the current draft when a stale autosave arrives", async () => {
    const { assignment, employee, selectedFactId, selfEntries, service } = await fixture();
    const first = await service.saveDraft({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: employee.id,
      kind: "SELF",
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
      entries: [selfEntries[0]!],
    });
    expect(first).toMatchObject({ kind: "SELF", version: 2, entries: [selfEntries[0]] });

    const current = await service.saveDraft({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: employee.id,
      kind: "SELF",
      expectedVersion: 2,
      idempotencyKey: crypto.randomUUID(),
      entries: selfEntries,
    });
    const stale = await service.saveDraft({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: employee.id,
      kind: "SELF",
      expectedVersion: 2,
      idempotencyKey: crypto.randomUUID(),
      entries: [{ ...selfEntries[0]!, sourceReferences: [selectedFactId] }],
    });

    expect(stale).toEqual(current);
    await expect(
      client.assessmentRevision.count({ where: { assessmentId: current.id } }),
    ).resolves.toBe(2);
    await expect(
      client.assessmentRevision.findFirstOrThrow({
        where: { assessmentId: current.id },
        orderBy: { revision: "desc" },
      }),
    ).resolves.toMatchObject({ entries: selfEntries });
  });

  it("rejects cross-role writes and source IDs outside the authorized Fact View", async () => {
    const { assignment, employee, outsider, selfEntries, service } = await fixture();
    const input = {
      schemaVersion: 1 as const,
      assignmentId: assignment.id,
      actorId: outsider.id,
      kind: "SELF" as const,
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
      entries: selfEntries,
    };
    await expect(service.saveDraft(input)).rejects.toMatchObject({ code: "AUTHZ_SCOPE" });
    await expect(
      service.saveDraft({
        ...input,
        actorId: employee.id,
        idempotencyKey: crypto.randomUUID(),
        entries: [{ ...selfEntries[0]!, sourceReferences: [crypto.randomUUID()] }],
      }),
    ).rejects.toMatchObject({ code: "EVALUATION_FACT_SOURCE_NOT_AUTHORIZED" });
  });

  it("requires the frozen 12 fixed criteria and exactly one Project Contribution judgment", async () => {
    const { assignment, employee, selfEntries, service } = await fixture();
    const draft = await service.saveDraft({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: employee.id,
      kind: "SELF",
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
      entries: selfEntries.slice(0, -1),
    });

    await expect(
      service.submit({
        schemaVersion: 1,
        assignmentId: assignment.id,
        actorId: employee.id,
        kind: "SELF",
        expectedVersion: draft.version,
        idempotencyKey: crypto.randomUUID(),
        confirmedAt: now.toISOString(),
      }),
    ).rejects.toMatchObject({ code: "EVALUATION_ASSESSMENT_INCOMPLETE" });
  });

  it("freezes an idempotent submission with pinned sources and rolls audit failure back", async () => {
    const { assignment, employee, selfEntries, service } = await fixture();
    const draft = await service.saveDraft({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: employee.id,
      kind: "SELF",
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
      entries: selfEntries,
    });
    const submitInput = {
      schemaVersion: 1 as const,
      assignmentId: assignment.id,
      actorId: employee.id,
      kind: "SELF" as const,
      expectedVersion: draft.version,
      idempotencyKey: crypto.randomUUID(),
      confirmedAt: now.toISOString(),
    };
    const receipt = await service.submit(submitInput);

    await expect(service.submit(submitInput)).resolves.toEqual(receipt);
    expect(receipt).toMatchObject({
      assignmentId: assignment.id,
      kind: "SELF",
      selfProjectionAccessedBeforeSubmit: false,
    });
    await expect(
      client.assessmentRevision.findUniqueOrThrow({ where: { id: receipt.revisionId } }),
    ).resolves.toMatchObject({ entries: selfEntries });
    await expect(
      service.saveDraft({
        schemaVersion: 1,
        assignmentId: assignment.id,
        actorId: employee.id,
        kind: "SELF",
        expectedVersion: draft.version,
        idempotencyKey: crypto.randomUUID(),
        entries: selfEntries,
      }),
    ).rejects.toMatchObject({ code: "EVALUATION_ASSESSMENT_IMMUTABLE" });

    const rollbackFixture = await fixture();
    const rollbackDraft = await rollbackFixture.service.saveDraft({
      schemaVersion: 1,
      assignmentId: rollbackFixture.assignment.id,
      actorId: rollbackFixture.employee.id,
      kind: "SELF",
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
      entries: rollbackFixture.selfEntries,
    });
    const failingService = new AssessmentService(
      client,
      { read: async () => rollbackFixture.factView },
      {
        append: async () => {
          throw new Error("audit unavailable");
        },
      },
      () => now,
    );
    await expect(
      failingService.submit({
        schemaVersion: 1,
        assignmentId: rollbackFixture.assignment.id,
        actorId: rollbackFixture.employee.id,
        kind: "SELF",
        expectedVersion: rollbackDraft.version,
        idempotencyKey: crypto.randomUUID(),
        confirmedAt: now.toISOString(),
      }),
    ).rejects.toThrow("audit unavailable");
    await expect(
      client.assessmentSubmission.count({
        where: { assignmentId: rollbackFixture.assignment.id, kind: "SELF" },
      }),
    ).resolves.toBe(0);
  });

  it("keeps self content inaccessible until the manager submits and stores independence proof", async () => {
    const { assignment, cycle, employee, manager, managerEntries, selfEntries, service } =
      await fixture();
    const selfDraft = await service.saveDraft({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: employee.id,
      kind: "SELF",
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
      entries: selfEntries,
    });
    await service.submit({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: employee.id,
      kind: "SELF",
      expectedVersion: selfDraft.version,
      idempotencyKey: crypto.randomUUID(),
      confirmedAt: now.toISOString(),
    });
    await client.employeeEvaluationCycle.update({
      where: { id: cycle.id },
      data: { state: "MANAGER_ASSESSMENT", version: { increment: 1 } },
    });

    await expect(
      service.readSelfAssessment({ assignmentId: assignment.id, managerId: manager.id }),
    ).rejects.toMatchObject({ code: "EVALUATION_INDEPENDENCE_GATE" });

    const managerDraft = await service.saveDraft({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: manager.id,
      kind: "MANAGER_INITIAL",
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
      entries: managerEntries,
    });
    const managerReceipt = await service.submit({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: manager.id,
      kind: "MANAGER_INITIAL",
      expectedVersion: managerDraft.version,
      idempotencyKey: crypto.randomUUID(),
      confirmedAt: now.toISOString(),
    });

    expect(managerReceipt.selfProjectionAccessedBeforeSubmit).toBe(false);
    await expect(
      service.readSelfAssessment({ assignmentId: assignment.id, managerId: manager.id }),
    ).resolves.toMatchObject({ kind: "SELF", entries: selfEntries });
    await expect(
      client.assessmentSubmission.findUniqueOrThrow({ where: { id: managerReceipt.id } }),
    ).resolves.toMatchObject({ selfProjectionAccessedBeforeSubmit: false });
  });
});

function completeEntries(
  items: ReadonlyArray<{ id: string; kind: "FIXED_CRITERION" | "PROJECT_CONTRIBUTION" }>,
  sourceId: string,
  kind: "SELF" | "MANAGER_INITIAL",
) {
  return items.map((item) => ({
    criterionId: item.id,
    rating: 3 as const,
    justification: `Human judgment for ${item.id}.`,
    sourceReferences: [sourceId],
    directObservationBasis: kind === "MANAGER_INITIAL" ? "Observed across the full period." : null,
  }));
}

function evaluationFactView(
  cycleId: string,
  employeeId: string,
  rubricVersionId: string,
  selectedFactId: string,
  alternateFactId: string,
) {
  const projectId = crypto.randomUUID();
  return {
    schemaVersion: 2 as const,
    cycle: {
      id: cycleId,
      startsAt: "2026-07-01T00:00:00Z",
      endsAt: "2026-10-01T00:00:00Z",
      rubricVersionId,
    },
    subjectEmployeeId: employeeId,
    generatedAt: now.toISOString(),
    responsibilityWindows: [],
    projectFacts: [selectedFactId, alternateFactId].map((sourceId) => ({
      kind: "source_fact" as const,
      sourceId,
      sourceOccurredAt: "2026-08-01T00:00:00Z",
      projectId,
      workstreamId: null,
      sourceType: "project_contribution" as const,
      relatedWorkItemId: null,
      criterionStableId: null,
      criterionVersionId: null,
      summary: "A source-supported project contribution.",
      result: "The approved acceptance condition was met.",
      verificationState: "source_supported" as const,
      attributionState: "employee_confirmed" as const,
      responsibilityWindowIds: [],
      sourceReferences: [
        {
          sourceType: "timeline_event" as const,
          sourceId,
          sourceVersion: 1,
          occurredAt: "2026-08-01T00:00:00Z",
          url: null,
        },
      ],
    })),
    confirmedEvidence: [],
    checkInFacts: [],
    dynamicCriteriaVersions: [],
    researchFacts: [],
    employeeInterpretations: [],
    sourceCoverageNotes: [],
  };
}
