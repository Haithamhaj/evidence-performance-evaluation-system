import path from "node:path";
import { fileURLToPath } from "node:url";

import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import {
  ManagerEvaluationCycleService,
  ManagerEvaluationSubmissionService,
} from "@evaluation/manager-evaluation";

import { seedPilotWithAudit } from "./seed-pilot.js";

const fixed = {
  sourceEligibilityCycle: "5a000000-0000-4000-8000-000000000001",
  sourceEligibilitySnapshot: "5a000000-0000-4000-8000-000000000002",
  employeeCycle: "5a000000-0000-4000-8000-000000000003",
  employeeCycleSnapshot: "5a000000-0000-4000-8000-000000000004",
  managerTemplate: "5a000000-0000-4000-8000-000000000005",
  managerTemplateVersion: "5a000000-0000-4000-8000-000000000006",
  policy: "5a000000-0000-4000-8000-000000000007",
  managerCycleOpen: "5a000000-0000-4000-8000-000000000008",
  response: "5a000000-0000-4000-8000-000000000009",
  leave: "5a000000-0000-4000-8000-000000000010",
} as const;
const startsAt = "2026-07-01T00:00:00.000Z";
const endsAt = "2026-10-01T00:00:00.000Z";
const now = new Date("2026-08-06T12:00:00.000Z");

export async function seedManagerEvaluationAcceptance(
  database: ReturnType<typeof createDatabaseClient>,
  identity: Readonly<{ managerSubject: string; adminSubject: string; oidcIssuer: string }>,
) {
  await seedPilotWithAudit(database, identity);
  const [organization, department, manager, administrator, rubric, employeeTemplate] =
    await Promise.all([
      database.organization.findUniqueOrThrow({ where: { key: "leapai" } }),
      database.department.findUniqueOrThrow({ where: { key: "ai-department" } }),
      database.user.findUniqueOrThrow({ where: { pilotKey: "pilot-manager" } }),
      database.user.findUniqueOrThrow({ where: { pilotKey: "system-admin" } }),
      database.rubricVersion.findFirstOrThrow({
        where: { organization: { key: "leapai" }, version: "1" },
      }),
      database.evaluationTemplateVersion.findFirstOrThrow({
        where: { template: { key: "pilot-employee-evaluation" } },
        orderBy: { versionNumber: "asc" },
      }),
    ]);
  const employees = await Promise.all(
    [
      ["identified-feedback-one@seed.invalid", "Amina Al-Harbi"],
      ["identified-feedback-two@seed.invalid", "Omar Al-Qahtani"],
      ["identified-feedback-leave@seed.invalid", "Lina Al-Salem"],
    ].map(([email, displayName]) =>
      database.user.upsert({
        where: { email: email! },
        create: { email: email!, displayName: displayName! },
        update: { active: true, displayName: displayName! },
      }),
    ),
  );
  await ensureSourceBoundary(database, {
    departmentId: department.id,
    managerId: manager.id,
    administratorId: administrator.id,
    rubricVersionId: rubric.id,
    employeeTemplateVersionId: employeeTemplate.id,
    employees,
  });
  const managerCriteria = await database.rubricCriterion.findMany({
    where: { rubricLocale: { rubricVersionId: rubric.id, locale: "en" }, kind: "manager" },
    include: { anchors: { orderBy: { rating: "asc" } } },
    orderBy: { displayOrder: "asc" },
  });
  if (managerCriteria.length !== 5)
    throw new Error("Approved manager rubric requires five criteria");
  await ensureManagerConfiguration(database, {
    organizationId: organization.id,
    departmentId: department.id,
    administratorId: administrator.id,
    rubricVersionId: rubric.id,
    criteria: managerCriteria,
  });
  const cycles = new ManagerEvaluationCycleService(
    database,
    boundaryReader,
    databaseAuditWriter as never,
    () => now,
  );
  const opened = await cycles.open({
    schemaVersion: 1,
    employeeEvaluationCycleId: fixed.employeeCycle,
    departmentId: department.id,
    managerId: manager.id,
    rubricVersionId: rubric.id,
    visibilityPolicyVersion: 1,
    visibilityMode: "IDENTIFIED",
    startsAt,
    endsAt,
    actorId: administrator.id,
    expectedVersion: 1,
    idempotencyKey: fixed.managerCycleOpen,
    reason: "Open the deterministic identified pilot manager-evaluation cycle.",
  });
  const criteria = await database.managerEvaluationCriterion.findMany({
    where: { templateVersionId: fixed.managerTemplateVersion },
    orderBy: { displayOrder: "asc" },
  });
  const submissions = new ManagerEvaluationSubmissionService(
    database,
    databaseAuditWriter as never,
    () => now,
  );
  const response = await submissions.submit({
    schemaVersion: 1,
    cycleId: opened.id,
    evaluatorId: employees[0]!.id,
    expectedVersion: 1,
    idempotencyKey: fixed.response,
    identifiedNoticeConfirmed: true,
    confirmedAt: now.toISOString(),
    responses: criteria.map((criterion, index) => ({
      criterionId: criterion.id,
      rating: ([4, 4, 3, 4, 3] as const)[index]!,
      comment: `Named acceptance feedback for ${criterion.stableCriterionId}.`,
    })),
  });
  const leaveEligibility = opened.eligibilities.find(
    ({ evaluatorId }) => evaluatorId === employees[2]!.id,
  );
  if (leaveEligibility === undefined) throw new Error("Leave evaluator was not frozen");
  await cycles.recordEligibilityDecision({
    schemaVersion: 1,
    cycleId: opened.id,
    evaluatorId: employees[2]!.id,
    actorId: manager.id,
    state: "APPROVED_LEAVE",
    effectiveAt: now.toISOString(),
    expectedVersion: 1,
    idempotencyKey: fixed.leave,
    reason: "Approved leave excludes this evaluator from the current completion requirement.",
  });
  return {
    cycleId: opened.id,
    responseId: response.responseId,
    managerId: manager.id,
    administratorId: administrator.id,
    employeeId: employees[0]!.id,
    pendingEmployeeId: employees[1]!.id,
    leaveEmployeeId: employees[2]!.id,
  };
}

async function ensureSourceBoundary(
  database: ReturnType<typeof createDatabaseClient>,
  input: {
    departmentId: string;
    managerId: string;
    administratorId: string;
    rubricVersionId: string;
    employeeTemplateVersionId: string;
    employees: ReadonlyArray<{ id: string; displayName: string }>;
  },
) {
  if (await database.employeeEvaluationCycle.findUnique({ where: { id: fixed.employeeCycle } }))
    return;
  await database.$transaction(async (transaction) => {
    const latest = await transaction.evaluationCycle.findFirst({
      where: { departmentId: input.departmentId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const eligibilityCycle = await transaction.evaluationCycle.create({
      data: {
        id: fixed.sourceEligibilityCycle,
        departmentId: input.departmentId,
        managerId: input.managerId,
        version: (latest?.version ?? 0) + 1,
        visibilityMode: "identified",
        sourceReason: "Frozen E4 timing, manager, and employee eligibility.",
        effectiveFrom: new Date(startsAt),
        effectiveTo: new Date(endsAt),
      },
    });
    await transaction.eligibilitySnapshot.create({
      data: {
        id: fixed.sourceEligibilitySnapshot,
        cycleId: eligibilityCycle.id,
        version: eligibilityCycle.version,
        visibilityMode: "identified",
        sourceReason: "Frozen E4 timing, manager, and employee eligibility.",
        effectiveFrom: new Date(startsAt),
        effectiveTo: new Date(endsAt),
        entries: {
          create: input.employees.map((employee, position) => ({
            employeeId: employee.id,
            position,
            state: "active",
            sourceReason: "Active at the frozen cycle boundary.",
            effectiveFrom: new Date(startsAt),
            effectiveTo: new Date(endsAt),
          })),
        },
      },
    });
  });
  await database.evaluationCycle.update({
    where: { id: fixed.sourceEligibilityCycle },
    data: { openedAt: now },
  });
  await database.$transaction(async (transaction) => {
    const sequence =
      (
        await transaction.employeeEvaluationCycle.findFirst({
          where: { departmentId: input.departmentId },
          orderBy: { sequence: "desc" },
          select: { sequence: true },
        })
      )?.sequence ?? 0;
    await transaction.employeeEvaluationCycle.create({
      data: {
        id: fixed.employeeCycle,
        idempotencyKey: fixed.employeeCycle,
        departmentId: input.departmentId,
        templateVersionId: input.employeeTemplateVersionId,
        sequence: sequence + 1,
        cycleType: sequence === 0 ? "CALIBRATION_NON_BASELINE" : "STANDARD",
        state: "OPEN_PREPARATION",
        visibilityMode: "identified",
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        createdById: input.administratorId,
        openedAt: now,
        snapshot: {
          create: {
            id: fixed.employeeCycleSnapshot,
            templateVersionId: input.employeeTemplateVersionId,
            rubricVersionId: input.rubricVersionId,
            eligibilitySnapshotId: fixed.sourceEligibilitySnapshot,
            cycleType: sequence === 0 ? "CALIBRATION_NON_BASELINE" : "STANDARD",
            visibilityMode: "identified",
            startsAt: new Date(startsAt),
            endsAt: new Date(endsAt),
            ratingScale: [1, 2, 3, 4, 5],
            templateSnapshot: { source: "approved-v1" },
            localeAvailability: ["en"],
            configurationVersions: { rubricVersionId: input.rubricVersionId },
          },
        },
        assignments: {
          create: input.employees.map((employee) => ({
            employeeId: employee.id,
            managerId: input.managerId,
            eligibilityState: "ELIGIBLE",
            eligibilityReason: "Active at the frozen cycle boundary.",
            eligibilityEffectiveAt: new Date(startsAt),
          })),
        },
      },
    });
  });
}

async function ensureManagerConfiguration(
  database: ReturnType<typeof createDatabaseClient>,
  input: {
    organizationId: string;
    departmentId: string;
    administratorId: string;
    rubricVersionId: string;
    criteria: ReadonlyArray<{
      id: string;
      stableId: string;
      anchors: ReadonlyArray<{ rating: number; text: string }>;
    }>;
  },
) {
  await database.$transaction(async (transaction) => {
    const template = await transaction.managerEvaluationTemplate.findUnique({
      where: { id: fixed.managerTemplate },
    });
    if (template === null) {
      await transaction.managerEvaluationTemplate.create({
        data: {
          id: fixed.managerTemplate,
          organizationId: input.organizationId,
          departmentId: input.departmentId,
          key: "pilot-identified-manager-evaluation",
          name: "Pilot Identified Manager Evaluation",
          createdById: input.administratorId,
          versions: {
            create: {
              id: fixed.managerTemplateVersion,
              rubricVersionId: input.rubricVersionId,
              versionNumber: 1,
              status: "ACTIVE",
              commentRequired: false,
              ratingScale: [1, 2, 3, 4, 5],
              localeAvailability: ["en"],
              configuration: { cadence: "QUARTERLY", visibilityMode: "IDENTIFIED" },
              createdById: input.administratorId,
              activatedById: input.administratorId,
              activatedAt: now,
              criteria: {
                create: input.criteria.map((criterion, displayOrder) => ({
                  id: `5b000000-0000-4000-8000-${String(displayOrder + 1).padStart(12, "0")}`,
                  rubricCriterionId: criterion.id,
                  stableCriterionId: criterion.stableId,
                  displayOrder,
                  commentRequired: false,
                  anchorSnapshot: criterion.anchors,
                })),
              },
            },
          },
        },
      });
    }
    if (
      (await transaction.managerEvaluationVisibilityPolicy.findUnique({
        where: { id: fixed.policy },
      })) === null
    ) {
      await transaction.managerEvaluationVisibilityPolicy.create({
        data: {
          id: fixed.policy,
          organizationId: input.organizationId,
          version: 1,
          mode: "IDENTIFIED",
          enabled: true,
          managerCanReadIdentity: true,
          managerCanReadOriginals: true,
          immediateVisibility: true,
          policy: { disclosure: "identified", publication: "immediate" },
          createdById: input.administratorId,
        },
      });
    }
  });
}

const boundaryReader: import("@evaluation/manager-evaluation").FrozenEmployeeEvaluationBoundaryReader =
  {
    read: async (transaction, cycleId) => {
      const cycle = await transaction.employeeEvaluationCycle.findUnique({
        where: { id: cycleId },
        include: {
          snapshot: true,
          assignments: { include: { employee: true }, orderBy: { createdAt: "asc" } },
        },
      });
      if (cycle === null || cycle.snapshot === null || cycle.assignments.length === 0) return null;
      return {
        cycleId: cycle.id,
        departmentId: cycle.departmentId,
        startsAt: cycle.startsAt.toISOString(),
        endsAt: cycle.endsAt.toISOString(),
        rubricVersionId: cycle.snapshot.rubricVersionId,
        managerId: cycle.assignments[0]!.managerId,
        entries: cycle.assignments.map((assignment) => ({
          employeeId: assignment.employeeId,
          employeeDisplayName: assignment.employee.displayName,
          state: assignment.eligibilityState,
          reason: assignment.eligibilityReason,
          effectiveAt: assignment.eligibilityEffectiveAt.toISOString(),
        })),
      };
    },
  };

async function main() {
  const database = createDatabaseClient(required("DATABASE_URL"));
  try {
    const result = await seedManagerEvaluationAcceptance(database, {
      managerSubject: required("PILOT_MANAGER_OIDC_SUBJECT"),
      adminSubject: required("PILOT_ADMIN_OIDC_SUBJECT"),
      oidcIssuer: required("OIDC_ISSUER"),
    });
    process.stdout.write(`${JSON.stringify({ status: "ready", ...result })}\n`);
  } finally {
    await database.$disconnect();
  }
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const isDirect =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) await main();
