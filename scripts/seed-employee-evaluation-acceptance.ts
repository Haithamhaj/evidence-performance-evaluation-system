import path from "node:path";
import { fileURLToPath } from "node:url";

import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import {
  AssessmentService,
  EmployeeEvaluationCycleService,
  EvaluationDiscussionService,
  EvaluationTemplateService,
  FinalizationService,
} from "@evaluation/employee-evaluation";
import { approvedEnglishRubric } from "@evaluation/localization";

import { seedPilotWithAudit } from "./seed-pilot.js";

const now = new Date("2026-08-06T12:00:00.000Z");
const cycleOpenKey = "ee200000-0000-4000-8000-000000000001";
const templateActivationKey = "ee200000-0000-4000-8000-000000000002";
const sourceId = "ee200000-0000-4000-8000-000000000003";
const projectId = "ee200000-0000-4000-8000-000000000004";

async function main(): Promise<void> {
  const database = createDatabaseClient(required("DATABASE_URL"));
  try {
    await seedPilotWithAudit(database, {
      managerSubject: required("PILOT_MANAGER_OIDC_SUBJECT"),
      adminSubject: required("PILOT_ADMIN_OIDC_SUBJECT"),
      oidcIssuer: required("OIDC_ISSUER"),
    });
    const [organization, department, manager, administrator] = await Promise.all([
      database.organization.findUniqueOrThrow({ where: { key: "leapai" } }),
      database.department.findUniqueOrThrow({ where: { key: "ai-department" } }),
      database.user.findUniqueOrThrow({ where: { pilotKey: "pilot-manager" } }),
      database.user.findUniqueOrThrow({ where: { pilotKey: "system-admin" } }),
    ]);
    const employee = await database.user.upsert({
      where: { email: "evaluation-acceptance-employee@seed.invalid" },
      create: {
        email: "evaluation-acceptance-employee@seed.invalid",
        displayName: "Evaluation Acceptance Employee",
      },
      update: { active: true, displayName: "Evaluation Acceptance Employee" },
    });
    const template = await database.evaluationTemplate.findUniqueOrThrow({
      where: {
        organizationId_departmentId_key: {
          organizationId: organization.id,
          departmentId: department.id,
          key: "pilot-employee-evaluation",
        },
      },
      include: { versions: { orderBy: { versionNumber: "asc" }, take: 1 } },
    });
    const templateVersion = template.versions[0];
    if (templateVersion === undefined) throw new Error("Pilot evaluation template V1 is missing");
    if (templateVersion.status === "DRAFT") {
      const templates = new EvaluationTemplateService(
        database,
        approvedRubricReader(organization.id, templateVersion.rubricVersionId),
        {
          departmentBelongsToOrganization: async (transaction, input) =>
            (await transaction.department.count({
              where: { id: input.departmentId, organizationId: input.organizationId },
            })) === 1,
        },
        databaseAuditWriter,
        () => now,
      );
      await templates.activateVersion({
        schemaVersion: 1,
        versionId: templateVersion.id,
        actorId: administrator.id,
        expectedVersion: templateVersion.version,
        idempotencyKey: templateActivationKey,
        reason: "Activate the approved pilot evaluation template for acceptance verification.",
      });
    }

    const existing = await database.employeeEvaluationCycle.findUnique({
      where: { idempotencyKey: cycleOpenKey },
      include: { assignments: true },
    });
    if (existing?.state === "CLOSED") {
      printReceipt(existing.id, existing.assignments[0]?.id ?? null, existing.state);
      return;
    }
    if (existing !== null) {
      throw new Error(`Acceptance cycle exists in incomplete state ${existing.state}`);
    }

    const eligibilityReader: import("@evaluation/employee-evaluation").EligibilitySnapshotReader = {
      readCycleEligibility: async (input, transaction) => {
        const latest = await transaction.evaluationCycle.findFirst({
          where: { departmentId: input.departmentId },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const eligibilityVersion = (latest?.version ?? 0) + 1;
        const eligibilityCycle = await transaction.evaluationCycle.create({
          data: {
            departmentId: input.departmentId,
            managerId: manager.id,
            version: eligibilityVersion,
            visibilityMode: "identified",
            sourceReason: "Deterministic acceptance eligibility boundary.",
            effectiveFrom: new Date(input.startsAt),
            effectiveTo: new Date(input.endsAt),
          },
        });
        const snapshot = await transaction.eligibilitySnapshot.create({
          data: {
            cycleId: eligibilityCycle.id,
            version: eligibilityVersion,
            visibilityMode: "identified",
            sourceReason: "Deterministic acceptance eligibility boundary.",
            effectiveFrom: new Date(input.startsAt),
            effectiveTo: new Date(input.endsAt),
          },
        });
        await transaction.evaluationCycle.update({
          where: { id: eligibilityCycle.id },
          data: { openedAt: now },
        });
        return {
          id: snapshot.id,
          version: snapshot.version,
          managerId: manager.id,
          visibilityMode: "identified",
          effectiveFrom: input.startsAt,
          effectiveTo: input.endsAt,
          entries: [
            {
              employeeId: employee.id,
              state: "active",
              sourceReason: "Active employee at the frozen acceptance boundary.",
              effectiveFrom: input.startsAt,
              effectiveTo: input.endsAt,
            },
          ],
        };
      },
    };
    const cycles = new EmployeeEvaluationCycleService(
      database,
      eligibilityReader,
      databaseAuditWriter,
      () => now,
    );
    const opened = await cycles.openCycle({
      schemaVersion: 1,
      organizationId: organization.id,
      departmentId: department.id,
      templateVersionId: templateVersion.id,
      actorId: manager.id,
      cycleType: "CALIBRATION_NON_BASELINE",
      startsAt: "2026-07-01T00:00:00Z",
      endsAt: "2026-10-01T00:00:00Z",
      expectedVersion: 1,
      idempotencyKey: cycleOpenKey,
      reason: "Open the deterministic Cycle 1 acceptance verification.",
    });
    const assignment = opened.assignments[0];
    if (assignment === undefined) throw new Error("Acceptance assignment was not created");
    await transition(cycles, opened.id, manager.id, "OPEN_PREPARATION", "SELF_ASSESSMENT", 1, 10);

    const items = await database.evaluationTemplateItem.findMany({
      where: { versionId: templateVersion.id },
      orderBy: { displayOrder: "asc" },
    });
    const factView = acceptanceFactView(opened.id, employee.id, templateVersion.rubricVersionId);
    const assessments = new AssessmentService(
      database,
      { read: async () => factView },
      databaseAuditWriter,
      () => now,
    );
    const selfDraft = await assessments.saveDraft({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: employee.id,
      kind: "SELF",
      expectedVersion: 1,
      idempotencyKey: keyed(11),
      entries: assessmentEntries(items, "SELF"),
    });
    await assessments.submit({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: employee.id,
      kind: "SELF",
      expectedVersion: selfDraft.version,
      idempotencyKey: keyed(12),
      confirmedAt: now.toISOString(),
    });
    await transition(cycles, opened.id, manager.id, "SELF_ASSESSMENT", "MANAGER_ASSESSMENT", 2, 13);
    const managerDraft = await assessments.saveDraft({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: manager.id,
      kind: "MANAGER_INITIAL",
      expectedVersion: 1,
      idempotencyKey: keyed(14),
      entries: assessmentEntries(items, "MANAGER_INITIAL"),
    });
    await assessments.submit({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: manager.id,
      kind: "MANAGER_INITIAL",
      expectedVersion: managerDraft.version,
      idempotencyKey: keyed(15),
      confirmedAt: now.toISOString(),
    });
    await assessments.readSelfAssessment({ assignmentId: assignment.id, managerId: manager.id });
    await transition(cycles, opened.id, manager.id, "MANAGER_ASSESSMENT", "COMPARISON", 3, 16);
    const discussion = new EvaluationDiscussionService(database, databaseAuditWriter as never);
    await discussion.add({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: manager.id,
      body: "The employee and manager clarified the source-supported delivery context.",
      sourceReferences: [sourceId],
      expectedVersion: assignment.version,
      idempotencyKey: keyed(22),
    });
    await transition(cycles, opened.id, manager.id, "COMPARISON", "FINALIZATION", 4, 17);

    const finalization = new FinalizationService(
      database,
      { read: async () => ({ factView, developmentPlanReference: null }) },
      databaseAuditWriter,
      () => now,
    );
    await finalization.finalize({
      schemaVersion: 1,
      assignmentId: assignment.id,
      managerId: manager.id,
      expectedVersion: assignment.version + 1,
      idempotencyKey: keyed(18),
      entries: items.map((item) => ({
        criterionId: item.id,
        rating: 3,
        justification: `Final human manager judgment for ${item.stableCriterionId}.`,
        sourceReferences: [sourceId],
        managerInitialChangeReason: null,
      })),
      finalComment: "Final ratings were decided by the assigned human manager.",
    });
    await transition(cycles, opened.id, manager.id, "FINALIZATION", "ACKNOWLEDGMENT", 5, 19);
    await finalization.acknowledge({
      schemaVersion: 1,
      assignmentId: assignment.id,
      actorId: employee.id,
      expectedVersion: assignment.version + 2,
      idempotencyKey: keyed(20),
      kind: "ACKNOWLEDGED_WITH_RESERVATION",
      reservation: "I acknowledge receipt and ask that the documented delivery constraint remain.",
    });
    const closed = await finalization.close({
      schemaVersion: 1,
      cycleId: opened.id,
      actorId: manager.id,
      expectedVersion: 6,
      idempotencyKey: keyed(21),
      reason: "Close after the human decision and employee acknowledgment were preserved.",
    });
    printReceipt(closed.cycleId, assignment.id, closed.state);
  } finally {
    await database.$disconnect();
  }
}

function approvedRubricReader(organizationId: string, rubricVersionId: string) {
  return {
    readEvaluationRubric: async () => ({
      id: rubricVersionId,
      organizationId,
      version: approvedEnglishRubric.version,
      status: "active" as const,
      protectedGlobalCriterionIds: ["PPB-01", "PPB-02", "PPB-03"],
      locales: [
        {
          locale: "en",
          status: "active" as const,
          sourceHash: approvedEnglishRubric.sourceHash,
          sections: approvedEnglishRubric.sections,
          criteria: [
            ...approvedEnglishRubric.employeeCriteria,
            approvedEnglishRubric.projectContribution,
          ].map((criterion) => ({
            id: criterion.id,
            title: criterion.title,
            sectionId: criterion.sectionId,
            ...(criterion.internalWeight === undefined
              ? {}
              : { internalWeight: criterion.internalWeight }),
            anchors: criterion.anchors,
          })),
        },
      ],
    }),
  } satisfies import("@evaluation/employee-evaluation").EvaluationRubricReader;
}

function assessmentEntries(
  items: ReadonlyArray<{ id: string; stableCriterionId: string }>,
  kind: "SELF" | "MANAGER_INITIAL",
) {
  return items.map((item) => ({
    criterionId: item.id,
    rating: 3 as const,
    justification: `Human ${kind === "SELF" ? "self" : "manager"} judgment for ${item.stableCriterionId}.`,
    sourceReferences: [sourceId],
    directObservationBasis:
      kind === "MANAGER_INITIAL" ? "Observed by the assigned manager across the cycle." : null,
  }));
}

function acceptanceFactView(cycleId: string, employeeId: string, rubricVersionId: string) {
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
    projectFacts: [
      {
        kind: "source_fact" as const,
        sourceId,
        sourceOccurredAt: "2026-08-01T00:00:00Z",
        projectId,
        workstreamId: null,
        sourceType: "project_contribution" as const,
        relatedWorkItemId: null,
        criterionStableId: null,
        criterionVersionId: null,
        summary: "A deterministic source-supported project contribution.",
        result: "The acceptance condition was completed.",
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
      },
    ],
    confirmedEvidence: [],
    checkInFacts: [],
    dynamicCriteriaVersions: [],
    researchFacts: [],
    employeeInterpretations: [],
    sourceCoverageNotes: [],
  };
}

async function transition(
  service: EmployeeEvaluationCycleService,
  cycleId: string,
  actorId: string,
  fromState: import("@evaluation/contracts").EvaluationCycleState,
  toState: import("@evaluation/contracts").EvaluationCycleState,
  expectedVersion: number,
  key: number,
) {
  return service.transitionCycle({
    schemaVersion: 1,
    cycleId,
    actorId,
    fromState,
    toState,
    expectedVersion,
    idempotencyKey: keyed(key),
    reason: `Advance deterministic acceptance journey from ${fromState} to ${toState}.`,
  });
}

function keyed(value: number): string {
  return `ee200000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function printReceipt(cycleId: string, assignmentId: string | null, state: string): void {
  process.stdout.write(
    `${JSON.stringify({ cycleId, assignmentId, state, fixture: "postgresql-domain-services" })}\n`,
  );
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  await main();
}
