import { createDatabaseClient } from "@evaluation/database";
import { afterAll, describe, expect, it } from "vitest";

import { EvaluationReportReader } from "./report-reader.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-08-06T10:00:00Z");

afterAll(async () => client.$disconnect());

describe("EvaluationReportReader", () => {
  it("returns only the employee's own immutable cycle, final judgment, and reservation", async () => {
    const fixture = await reportFixture();
    const reader = new EvaluationReportReader(client);

    const report = await reader.readEmployee({
      assignmentId: fixture.assignment.id,
      requester: { actorId: fixture.employee.id, access: "self", active: true },
    });

    expect(report).toMatchObject({
      schemaVersion: 2,
      assignmentId: fixture.assignment.id,
      employeeId: fixture.employee.id,
      cycleId: fixture.cycle.id,
      cycleType: "STANDARD",
      state: "CLOSED",
      period: {
        startsAt: "2026-07-01T00:00:00.000Z",
        endsAt: "2026-10-01T00:00:00.000Z",
      },
      finalSnapshot: {
        id: fixture.finalSnapshot.id,
        entries: [{ criterionId: fixture.item.id, rating: 4 }],
        workFacts: [{ sourceId: fixture.sourceId }],
        researchFacts: [{ sourceId: fixture.researchSourceId }],
        selfAssessment: { entries: [{ rating: 4 }] },
        managerInitialAssessment: { entries: [{ rating: 3 }] },
        comparison: { schemaVersion: 2, entries: [{ gap: 1 }] },
        developmentPlanReference: null,
        closedAt: now.toISOString(),
      },
      acknowledgment: {
        kind: "ACKNOWLEDGED_WITH_RESERVATION",
        reservation: "I disagree with the context applied to this judgment.",
      },
    });
    await expect(
      reader.readEmployee({
        assignmentId: fixture.assignment.id,
        requester: { actorId: fixture.outsider.id, access: "self", active: true },
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE" });
  });

  it("returns manager-scoped anonymous rating distributions and trend points without protected content", async () => {
    const fixture = await reportFixture();
    const reader = new EvaluationReportReader(client);
    const [otherEmployee, otherManager] = await Promise.all([
      client.user.create({
        data: {
          email: `report-other-employee-${crypto.randomUUID()}@example.invalid`,
          displayName: "Other manager's employee",
        },
      }),
      client.user.create({
        data: {
          email: `report-other-manager-${crypto.randomUUID()}@example.invalid`,
          displayName: "Other manager",
        },
      }),
    ]);
    await client.evaluationAssignment.create({
      data: {
        cycleId: fixture.cycle.id,
        employeeId: otherEmployee.id,
        managerId: otherManager.id,
        eligibilityState: "ELIGIBLE",
        eligibilityReason: "Belongs to another manager's report scope.",
        eligibilityEffectiveAt: new Date("2026-07-01T00:00:00Z"),
      },
    });

    const report = await reader.readDepartment({
      cycleId: fixture.cycle.id,
      requester: {
        actorId: fixture.manager.id,
        departmentId: fixture.department.id,
        access: "assigned_manager",
        active: true,
      },
    });

    expect(report).toEqual({
      schemaVersion: 2,
      departmentId: fixture.department.id,
      cycleId: fixture.cycle.id,
      cycleType: "STANDARD",
      state: "CLOSED",
      period: {
        startsAt: "2026-07-01T00:00:00.000Z",
        endsAt: "2026-10-01T00:00:00.000Z",
      },
      ratingDistributions: [ratingDistribution("REPORT-CRITERION", 4)],
      trends: [
        {
          sequence: 1,
          cycleType: "CALIBRATION_NON_BASELINE",
          period: {
            startsAt: "2026-04-01T00:00:00.000Z",
            endsAt: "2026-07-01T00:00:00.000Z",
          },
          ratingDistributions: [ratingDistribution("REPORT-CRITERION", 3)],
        },
        {
          sequence: 2,
          cycleType: "STANDARD",
          period: {
            startsAt: "2026-07-01T00:00:00.000Z",
            endsAt: "2026-10-01T00:00:00.000Z",
          },
          ratingDistributions: [ratingDistribution("REPORT-CRITERION", 4)],
        },
      ],
    });
    expect(JSON.stringify(report)).not.toMatch(
      /employeeId|managerId|readiness|rank|peerNarrative|upward|reservation|justification|sourceReferences/i,
    );
    await expect(
      reader.readDepartment({
        cycleId: fixture.cycle.id,
        requester: {
          actorId: fixture.outsider.id,
          departmentId: fixture.department.id,
          access: "assigned_manager",
          active: true,
        },
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE" });
    await expect(
      reader.readDepartment({
        cycleId: fixture.cycle.id,
        requester: {
          actorId: fixture.manager.id,
          departmentId: crypto.randomUUID(),
          access: "assigned_manager",
          active: true,
        },
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE" });
  });
});

async function reportFixture() {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `report-${suffix}`, name: "Report Organization" },
  });
  const department = await client.department.create({
    data: {
      key: `report-department-${suffix}`,
      name: "Report Department",
      organizationId: organization.id,
    },
  });
  const [creator, employee, manager, outsider] = await Promise.all(
    ["creator", "employee", "manager", "outsider"].map((role) =>
      client.user.create({
        data: {
          email: `report-${role}-${suffix}@example.invalid`,
          displayName: `Report ${role}`,
        },
      }),
    ),
  );
  const rubricVersion = await client.rubricVersion.create({
    data: { organizationId: organization.id, version: `report-${suffix}` },
  });
  const template = await client.evaluationTemplate.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      scope: "DEPARTMENT",
      key: `report-template-${suffix}`,
      name: "Report Template",
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
  const item = await client.evaluationTemplateItem.create({
    data: {
      versionId: templateVersion.id,
      stableCriterionId: "REPORT-CRITERION",
      kind: "FIXED_CRITERION",
      sectionStableId: "REPORT",
      sectionWeight: 100,
      criterionWeight: 100,
      displayOrder: 0,
      mandatory: true,
    },
  });
  const eligibilityCycle = await client.evaluationCycle.create({
    data: {
      departmentId: department.id,
      managerId: manager!.id,
      version: 1,
      visibilityMode: "identified",
      sourceReason: "Report fixture.",
      effectiveFrom: new Date("2026-07-01T00:00:00Z"),
      effectiveTo: new Date("2026-10-01T00:00:00Z"),
    },
  });
  const eligibilitySnapshot = await client.eligibilitySnapshot.create({
    data: {
      cycleId: eligibilityCycle.id,
      version: 1,
      visibilityMode: "identified",
      sourceReason: "Report fixture.",
      effectiveFrom: new Date("2026-07-01T00:00:00Z"),
      effectiveTo: new Date("2026-10-01T00:00:00Z"),
    },
  });
  const cycle = await client.employeeEvaluationCycle.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      departmentId: department.id,
      templateVersionId: templateVersion.id,
      sequence: 2,
      cycleType: "STANDARD",
      state: "CLOSED",
      visibilityMode: "identified",
      startsAt: new Date("2026-07-01T00:00:00Z"),
      endsAt: new Date("2026-10-01T00:00:00Z"),
      version: 8,
      createdById: creator!.id,
      openedAt: now,
      closedAt: now,
      snapshot: {
        create: {
          templateVersionId: templateVersion.id,
          rubricVersionId: rubricVersion.id,
          eligibilitySnapshotId: eligibilitySnapshot.id,
          cycleType: "STANDARD",
          visibilityMode: "identified",
          startsAt: new Date("2026-07-01T00:00:00Z"),
          endsAt: new Date("2026-10-01T00:00:00Z"),
          ratingScale: [1, 2, 3, 4, 5],
          templateSnapshot: { items: [{ id: item.id, stableCriterionId: item.stableCriterionId }] },
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
          version: 3,
        },
      },
    },
    include: { assignments: true, snapshot: true },
  });
  const assignment = cycle.assignments[0]!;
  const sourceId = crypto.randomUUID();
  const researchSourceId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  for (const [kind, actor] of [
    ["SELF", employee!],
    ["MANAGER_INITIAL", manager!],
  ] as const) {
    const assessment = await client.assessment.create({
      data: { assignmentId: assignment.id, kind, version: 2 },
    });
    const revision = await client.assessmentRevision.create({
      data: {
        idempotencyKey: crypto.randomUUID(),
        assessmentId: assessment.id,
        revision: 1,
        entries: [
          {
            criterionId: item.id,
            rating: kind === "SELF" ? 4 : 3,
            justification: "Source-grounded human rationale.",
            sourceReferences: [sourceId],
            directObservationBasis: kind === "SELF" ? null : "Observed throughout the period.",
          },
        ],
        createdById: actor.id,
        createdAt: now,
      },
    });
    await client.assessmentSubmission.create({
      data: {
        idempotencyKey: crypto.randomUUID(),
        assignmentId: assignment.id,
        kind,
        assessmentId: assessment.id,
        revisionId: revision.id,
        cycleSnapshotId: cycle.snapshot!.id,
        submittedById: actor.id,
        confirmedAt: now,
      },
    });
  }
  const finalSnapshot = await client.finalEvaluationSnapshot.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      assignmentId: assignment.id,
      cycleId: cycle.id,
      employeeId: employee!.id,
      managerId: manager!.id,
      templateVersionId: templateVersion.id,
      cycleType: "STANDARD",
      finalComment: "Human final judgment.",
      schemaVersion: 2,
      reportSnapshot: {
        period: {
          startsAt: "2026-07-01T00:00:00.000Z",
          endsAt: "2026-10-01T00:00:00.000Z",
        },
        responsibilityWindows: [],
        workFacts: [reportProjectFact(sourceId, projectId)],
        researchFacts: [reportResearchFact(researchSourceId, projectId)],
        sourceCoverageNotes: [],
        selfAssessment: {
          submittedAt: now.toISOString(),
          entries: [reportAssessmentEntry(item.id, 4, sourceId, null)],
        },
        managerInitialAssessment: {
          submittedAt: now.toISOString(),
          entries: [reportAssessmentEntry(item.id, 3, sourceId, "Observed throughout the period.")],
        },
        comparison: {
          schemaVersion: 2,
          assignmentId: assignment.id,
          entries: [
            {
              criterionId: item.id,
              selfRating: 4,
              managerRating: 3,
              gap: 1,
              effectiveWeight: 100,
              highWeightGap: true,
              selfSourceReferences: [sourceId],
              managerSourceReferences: [sourceId],
              sourceDifference: { selfOnly: [], managerOnly: [] },
              missingRationale: { self: false, manager: false },
              responsibilityDurationInterpretation: [],
              disputedAttributionSourceIds: [],
              discussionRequired: true,
            },
          ],
          discussionEntries: [],
          generatedAt: now.toISOString(),
        },
        developmentPlanReference: null,
      },
      finalizedAt: now,
      decisions: {
        create: {
          assignmentId: assignment.id,
          templateItemId: item.id,
          stableCriterionId: item.stableCriterionId,
          rating: 4,
          justification: "Manager's final human judgment.",
          sourceReferences: [sourceId],
          managerInitialChangeReason: "Discussion clarified the supported result.",
          managerId: manager!.id,
          position: 0,
        },
      },
    },
  });
  const previousCycle = await client.employeeEvaluationCycle.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      departmentId: department.id,
      templateVersionId: templateVersion.id,
      sequence: 1,
      cycleType: "CALIBRATION_NON_BASELINE",
      state: "CLOSED",
      visibilityMode: "identified",
      startsAt: new Date("2026-04-01T00:00:00Z"),
      endsAt: new Date("2026-07-01T00:00:00Z"),
      version: 8,
      createdById: creator!.id,
      openedAt: now,
      closedAt: now,
      snapshot: {
        create: {
          templateVersionId: templateVersion.id,
          rubricVersionId: rubricVersion.id,
          eligibilitySnapshotId: eligibilitySnapshot.id,
          cycleType: "CALIBRATION_NON_BASELINE",
          visibilityMode: "identified",
          startsAt: new Date("2026-04-01T00:00:00Z"),
          endsAt: new Date("2026-07-01T00:00:00Z"),
          ratingScale: [1, 2, 3, 4, 5],
          templateSnapshot: { items: [{ id: item.id, stableCriterionId: item.stableCriterionId }] },
          localeAvailability: ["en"],
          configurationVersions: { templateVersion: 1 },
        },
      },
      assignments: {
        create: {
          employeeId: employee!.id,
          managerId: manager!.id,
          eligibilityState: "ELIGIBLE",
          eligibilityReason: "Active during the calibration cycle.",
          eligibilityEffectiveAt: new Date("2026-04-01T00:00:00Z"),
          version: 2,
        },
      },
    },
    include: { assignments: true },
  });
  const previousAssignment = previousCycle.assignments[0]!;
  await client.finalEvaluationSnapshot.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      assignmentId: previousAssignment.id,
      cycleId: previousCycle.id,
      employeeId: employee!.id,
      managerId: manager!.id,
      templateVersionId: templateVersion.id,
      cycleType: "CALIBRATION_NON_BASELINE",
      finalComment: "Calibration judgment.",
      schemaVersion: 2,
      reportSnapshot: previousReportSnapshot(previousAssignment.id, item.id, sourceId),
      finalizedAt: now,
      decisions: {
        create: {
          assignmentId: previousAssignment.id,
          templateItemId: item.id,
          stableCriterionId: item.stableCriterionId,
          rating: 3,
          justification: "Calibration human judgment.",
          sourceReferences: [sourceId],
          managerInitialChangeReason: null,
          managerId: manager!.id,
          position: 0,
        },
      },
    },
  });
  await client.evaluationAcknowledgment.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      assignmentId: assignment.id,
      finalSnapshotId: finalSnapshot.id,
      actorId: employee!.id,
      kind: "ACKNOWLEDGED_WITH_RESERVATION",
      reservation: "I disagree with the context applied to this judgment.",
      recordedAt: now,
    },
  });
  return {
    assignment,
    cycle,
    department,
    employee: employee!,
    finalSnapshot,
    item,
    manager: manager!,
    outsider: outsider!,
    researchSourceId,
    sourceId,
  };
}

function previousReportSnapshot(assignmentId: string, criterionId: string, sourceId: string) {
  const entry = reportAssessmentEntry(criterionId, 3, sourceId, null);
  return {
    period: {
      startsAt: "2026-04-01T00:00:00.000Z",
      endsAt: "2026-07-01T00:00:00.000Z",
    },
    responsibilityWindows: [],
    workFacts: [],
    researchFacts: [],
    sourceCoverageNotes: [],
    selfAssessment: { submittedAt: now.toISOString(), entries: [entry] },
    managerInitialAssessment: {
      submittedAt: now.toISOString(),
      entries: [{ ...entry, directObservationBasis: "Observed during calibration." }],
    },
    comparison: {
      schemaVersion: 2,
      assignmentId,
      entries: [
        {
          criterionId,
          selfRating: 3,
          managerRating: 3,
          gap: 0,
          effectiveWeight: 100,
          highWeightGap: false,
          selfSourceReferences: [sourceId],
          managerSourceReferences: [sourceId],
          sourceDifference: { selfOnly: [], managerOnly: [] },
          missingRationale: { self: false, manager: false },
          responsibilityDurationInterpretation: [],
          disputedAttributionSourceIds: [],
          discussionRequired: false,
        },
      ],
      discussionEntries: [],
      generatedAt: now.toISOString(),
    },
    developmentPlanReference: null,
  };
}

function ratingDistribution(criterionStableId: string, selectedRating: number) {
  return {
    criterionStableId,
    buckets: [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: rating === selectedRating ? 1 : 0,
    })),
  };
}

function reportAssessmentEntry(
  criterionId: string,
  rating: number,
  sourceId: string,
  directObservationBasis: string | null,
) {
  return {
    criterionId,
    rating,
    justification: "Source-grounded human rationale.",
    sourceReferences: [sourceId],
    directObservationBasis,
  };
}

function reportFactReference(sourceId: string, sourceType: "timeline_event" | "experiment_run") {
  return {
    sourceType,
    sourceId,
    sourceVersion: 1,
    occurredAt: "2026-08-01T00:00:00Z",
    url: null,
  };
}

function reportProjectFact(sourceId: string, projectId: string) {
  return {
    kind: "source_fact",
    sourceId,
    sourceOccurredAt: "2026-08-01T00:00:00Z",
    projectId,
    workstreamId: null,
    sourceType: "project_contribution",
    relatedWorkItemId: null,
    criterionStableId: null,
    criterionVersionId: null,
    summary: "A source-supported project contribution.",
    result: "The acceptance condition was met.",
    verificationState: "source_supported",
    attributionState: "employee_confirmed",
    responsibilityWindowIds: [],
    sourceReferences: [reportFactReference(sourceId, "timeline_event")],
  };
}

function reportResearchFact(sourceId: string, projectId: string) {
  return {
    kind: "source_fact",
    sourceId,
    sourceOccurredAt: "2026-08-02T00:00:00Z",
    projectId,
    workstreamId: null,
    sourceType: "research",
    factType: "experiment_run",
    relatedWorkItemId: null,
    humanConfirmationState: "human_decision",
    verificationState: "source_supported",
    responsibilityWindowIds: [],
    summary: "The experiment result was human-confirmed.",
    limitations: [],
    uncertainty: null,
    sourceReferences: [reportFactReference(sourceId, "experiment_run")],
  };
}
