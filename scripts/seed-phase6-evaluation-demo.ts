import path from "node:path";
import { fileURLToPath } from "node:url";

import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { EmployeeEvaluationCycleService } from "@evaluation/employee-evaluation";

const now = new Date("2026-08-15T12:00:00.000Z");
const cycleOpenKey = "e6200000-0000-4000-8000-000000000001";
const transitionKey = "e6200000-0000-4000-8000-000000000002";

export async function seedPhase6EvaluationDemo(): Promise<
  Readonly<{
    cycleId: string;
    state: string;
    assignments: ReadonlyArray<{ assignmentId: string; employeeEmail: string }>;
  }>
> {
  const databaseUrl = required("DATABASE_URL");
  assertLocalDatabase(databaseUrl);
  const database = createDatabaseClient(databaseUrl);
  try {
    const existing = await database.employeeEvaluationCycle.findUnique({
      where: { idempotencyKey: cycleOpenKey },
      include: { assignments: { include: { employee: true } } },
    });
    if (existing !== null) {
      if (existing.state !== "SELF_ASSESSMENT") {
        throw new Error(`Phase 6 demo cycle is in unexpected state ${existing.state}`);
      }
      return receipt(existing);
    }

    const [templateVersion, manager, employees] = await Promise.all([
      database.evaluationTemplateVersion.findFirstOrThrow({
        where: { template: { key: "pilot-employee-evaluation" }, status: "ACTIVE" },
        include: { template: { include: { organization: true } } },
        orderBy: { versionNumber: "desc" },
      }),
      database.user.findUniqueOrThrow({
        where: { email: "phase1.manager@demo.invalid" },
      }),
      database.user.findMany({
        where: {
          email: {
            in: ["phase1.employee@demo.invalid", "codex.acceptance@local.invalid"],
          },
          active: true,
        },
        orderBy: { email: "asc" },
      }),
    ]);
    if (employees.length !== 2) throw new Error("Phase 6 demo requires both local employees");

    const eligibilityReader: import("@evaluation/employee-evaluation").EligibilitySnapshotReader = {
      readCycleEligibility: async (input, transaction) => {
        const latest = await transaction.evaluationCycle.findFirst({
          where: { departmentId: input.departmentId },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const version = (latest?.version ?? 0) + 1;
        const cycle = await transaction.evaluationCycle.create({
          data: {
            departmentId: input.departmentId,
            managerId: manager.id,
            version,
            visibilityMode: "identified",
            sourceReason: "Local Phase 6 employee-journey demonstration boundary.",
            effectiveFrom: new Date(input.startsAt),
            effectiveTo: new Date(input.endsAt),
          },
        });
        const snapshot = await transaction.eligibilitySnapshot.create({
          data: {
            cycleId: cycle.id,
            version,
            visibilityMode: "identified",
            sourceReason: "Local Phase 6 employee-journey demonstration boundary.",
            effectiveFrom: new Date(input.startsAt),
            effectiveTo: new Date(input.endsAt),
          },
        });
        await transaction.evaluationCycle.update({
          where: { id: cycle.id },
          data: { openedAt: now },
        });
        return {
          id: snapshot.id,
          version,
          managerId: manager.id,
          visibilityMode: "identified",
          effectiveFrom: input.startsAt,
          effectiveTo: input.endsAt,
          entries: employees.map((employee) => ({
            employeeId: employee.id,
            state: "active" as const,
            sourceReason: "Active local employee in the frozen Phase 6 demo boundary.",
            effectiveFrom: input.startsAt,
            effectiveTo: input.endsAt,
          })),
        };
      },
    };
    const service = new EmployeeEvaluationCycleService(
      database,
      eligibilityReader,
      {
        departmentBelongsToOrganization: async (transaction, input) =>
          (await transaction.department.count({
            where: { id: input.departmentId, organizationId: input.organizationId },
          })) === 1,
      },
      databaseAuditWriter,
      () => now,
    );
    const opened = await service.openCycle({
      schemaVersion: 1,
      organizationId: templateVersion.template.organization.id,
      departmentId: templateVersion.template.departmentId,
      templateVersionId: templateVersion.id,
      actorId: manager.id,
      cycleType: "CALIBRATION_NON_BASELINE",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-10-01T00:00:00.000Z",
      expectedVersion: 1,
      idempotencyKey: cycleOpenKey,
      reason: "Open the local Phase 6 employee evaluation journey for human review.",
    });
    await service.transitionCycle({
      schemaVersion: 1,
      cycleId: opened.id,
      actorId: manager.id,
      fromState: "OPEN_PREPARATION",
      toState: "SELF_ASSESSMENT",
      expectedVersion: 1,
      idempotencyKey: transitionKey,
      reason: "Make the local employee self-assessment journey available for review.",
    });
    const seeded = await database.employeeEvaluationCycle.findUniqueOrThrow({
      where: { id: opened.id },
      include: { assignments: { include: { employee: true } } },
    });
    return receipt(seeded);
  } finally {
    await database.$disconnect();
  }
}

function receipt(input: {
  id: string;
  state: string;
  assignments: ReadonlyArray<{ id: string; employee: { email: string } }>;
}) {
  return {
    cycleId: input.id,
    state: input.state,
    assignments: input.assignments.map((assignment) => ({
      assignmentId: assignment.id,
      employeeEmail: assignment.employee.email,
    })),
  };
}

function assertLocalDatabase(databaseUrl: string): void {
  if (process.env.APP_ENV !== "local") {
    throw new Error("Phase 6 demo seed requires APP_ENV=local");
  }
  const target = new URL(databaseUrl);
  if (target.protocol !== "postgresql:" || !["127.0.0.1", "localhost"].includes(target.hostname)) {
    throw new Error("Phase 6 demo seed requires a local PostgreSQL database");
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const output = await seedPhase6EvaluationDemo();
  process.stdout.write(`${JSON.stringify(output)}\n`);
}
