import {
  createRuntimeAiRouter,
  EnvironmentAiCredentialSecretResolver,
} from "@evaluation/ai-routing";
import { databaseAuditWriter } from "@evaluation/audit";
import { AppError } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";
import {
  IdentifiedCompletionReader,
  IdentifiedProjectionPolicy,
  ManagerEvaluationCycleService,
  ManagerEvaluationSubmissionService,
  ManagerEvaluationSummaryService,
} from "@evaluation/manager-evaluation";
import { Module } from "@nestjs/common";

import { createDeferredRuntimeAiRouter } from "../ai-routing/deferred-runtime-ai-router.js";
import { resolveSystemAiScopeId } from "../ai-routing/system-ai-scope.js";
import { AuthModule } from "../auth/auth.module.js";
import { ManagerEvaluationCyclesController } from "./cycles.controller.js";
import { ManagerEvaluationManagerViewController } from "./manager-view.controller.js";
import {
  MANAGER_EVALUATION_POLICY_DATABASE,
  ManagerEvaluationPolicyGuard,
} from "./manager-evaluation-policy.guard.js";
import { ManagerEvaluationSubmissionsController } from "./submissions.controller.js";

export const MANAGER_EVALUATION_DATABASE = Symbol("MANAGER_EVALUATION_DATABASE");
const MANAGER_EVALUATION_DATABASE_LIFECYCLE = Symbol("MANAGER_EVALUATION_DATABASE_LIFECYCLE");
type Database = ReturnType<typeof createDatabaseClient>;

export class ApiManagerEvaluationSummaryService {
  private readonly database: Database;
  constructor(database: Database) {
    this.database = database;
  }
  async createSummary(input: Readonly<{ cycleId: string; managerId: string }>) {
    const router = createDeferredRuntimeAiRouter(() =>
      createRuntimeAiRouter({
        database: this.database,
        secretResolver: new EnvironmentAiCredentialSecretResolver(),
      }),
    );
    return new ManagerEvaluationSummaryService({
      database: this.database,
      router,
      systemId: await resolveSystemAiScopeId(this.database, "manager-evaluation.summary"),
      timeoutMs: 30_000,
    }).createSummary(input);
  }
}

export class ApiFrozenEmployeeEvaluationBoundaryReader {
  async read(
    transaction: import("@evaluation/database").DatabaseTransaction,
    cycleId: string,
  ): Promise<import("@evaluation/manager-evaluation").FrozenEmployeeEvaluationBoundary | null> {
    const cycle = await transaction.employeeEvaluationCycle.findUnique({
      where: { id: cycleId },
      include: {
        snapshot: true,
        assignments: {
          include: { employee: { select: { displayName: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (cycle === null || cycle.snapshot === null || cycle.assignments.length === 0) return null;
    const managerIds = new Set(cycle.assignments.map(({ managerId }) => managerId));
    if (managerIds.size !== 1) {
      throw new AppError(
        "MANAGER_EVALUATION_BOUNDARY_INVALID",
        "errors.managerEvaluation.invalid",
        409,
      );
    }
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
    } as const;
  }
}

export class ManagerEvaluationModule {}

Module({
  imports: [AuthModule],
  controllers: [
    ManagerEvaluationCyclesController,
    ManagerEvaluationSubmissionsController,
    ManagerEvaluationManagerViewController,
  ],
  providers: [
    { provide: MANAGER_EVALUATION_DATABASE, useFactory: () => createDatabaseClient(databaseUrl()) },
    { provide: MANAGER_EVALUATION_POLICY_DATABASE, useExisting: MANAGER_EVALUATION_DATABASE },
    {
      provide: MANAGER_EVALUATION_DATABASE_LIFECYCLE,
      useFactory: (database: Database) => ({ onModuleDestroy: () => database.$disconnect() }),
      inject: [MANAGER_EVALUATION_DATABASE],
    },
    {
      provide: ManagerEvaluationCycleService,
      useFactory: (database: Database) =>
        new ManagerEvaluationCycleService(
          database,
          new ApiFrozenEmployeeEvaluationBoundaryReader(),
          databaseAuditWriter as never,
        ),
      inject: [MANAGER_EVALUATION_DATABASE],
    },
    {
      provide: ManagerEvaluationSubmissionService,
      useFactory: (database: Database) =>
        new ManagerEvaluationSubmissionService(database, databaseAuditWriter as never),
      inject: [MANAGER_EVALUATION_DATABASE],
    },
    {
      provide: IdentifiedCompletionReader,
      useFactory: (database: Database) => new IdentifiedCompletionReader(database),
      inject: [MANAGER_EVALUATION_DATABASE],
    },
    {
      provide: IdentifiedProjectionPolicy,
      useFactory: (database: Database) =>
        new IdentifiedProjectionPolicy(database, databaseAuditWriter as never),
      inject: [MANAGER_EVALUATION_DATABASE],
    },
    {
      provide: ApiManagerEvaluationSummaryService,
      useFactory: (database: Database) => new ApiManagerEvaluationSummaryService(database),
      inject: [MANAGER_EVALUATION_DATABASE],
    },
    ManagerEvaluationPolicyGuard,
  ],
})(ManagerEvaluationModule);

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL must be configured");
  return value;
}
