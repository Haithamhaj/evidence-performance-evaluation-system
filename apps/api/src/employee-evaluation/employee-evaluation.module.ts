import {
  createRuntimeAiRouter,
  EnvironmentAiCredentialSecretResolver,
} from "@evaluation/ai-routing";
import { databaseAuditWriter } from "@evaluation/audit";
import { AppError, EvaluationFactViewSchema } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";
import {
  AssessmentService,
  EmployeeEvaluationCycleService,
  EvaluationDiscussionService,
  EVALUATION_JUSTIFICATION_ROUTE,
  EvaluationReportReader,
  EvaluationTemplateService,
  EvaluationWordingService,
  FinalizationService,
} from "@evaluation/employee-evaluation";
import { EvaluationFactViewService } from "@evaluation/evaluation-preparation";
import { Module } from "@nestjs/common";

import { createDeferredRuntimeAiRouter } from "../ai-routing/deferred-runtime-ai-router.js";
import { resolveSystemAiScopeId } from "../ai-routing/system-ai-scope.js";
import { AuthModule } from "../auth/auth.module.js";
import { EvaluationPreparationModule } from "../evaluation-preparation/evaluation-preparation.module.js";
import { AssessmentsController } from "./assessments.controller.js";
import { EvaluationCyclesController } from "./cycles.controller.js";
import {
  EMPLOYEE_EVALUATION_POLICY_DATABASE,
  EmployeeEvaluationPolicyGuard,
} from "./employee-evaluation-policy.guard.js";
import { EmployeeEvaluationQueryService } from "./employee-evaluation-query.service.js";
import { FinalizationController } from "./finalization.controller.js";
import { EvaluationTemplatesController } from "./templates.controller.js";

export const EMPLOYEE_EVALUATION_DATABASE = Symbol("EMPLOYEE_EVALUATION_DATABASE");
const EMPLOYEE_EVALUATION_DATABASE_LIFECYCLE = Symbol("EMPLOYEE_EVALUATION_DATABASE_LIFECYCLE");
type Database = ReturnType<typeof createDatabaseClient>;

export class EmployeeEvaluationModule {}

Module({
  imports: [AuthModule, EvaluationPreparationModule],
  controllers: [
    EvaluationTemplatesController,
    EvaluationCyclesController,
    AssessmentsController,
    FinalizationController,
  ],
  providers: [
    {
      provide: EMPLOYEE_EVALUATION_DATABASE,
      useFactory: () => createDatabaseClient(databaseUrl()),
    },
    {
      provide: EMPLOYEE_EVALUATION_POLICY_DATABASE,
      useExisting: EMPLOYEE_EVALUATION_DATABASE,
    },
    {
      provide: EMPLOYEE_EVALUATION_DATABASE_LIFECYCLE,
      useFactory: (database: Database) => ({ onModuleDestroy: () => database.$disconnect() }),
      inject: [EMPLOYEE_EVALUATION_DATABASE],
    },
    {
      provide: EmployeeEvaluationQueryService,
      useFactory: (database: Database) => new EmployeeEvaluationQueryService(database),
      inject: [EMPLOYEE_EVALUATION_DATABASE],
    },
    {
      provide: AssessmentService,
      useFactory: (database: Database, facts: EvaluationFactViewService) =>
        new AssessmentService(database, facts, databaseAuditWriter as never),
      inject: [EMPLOYEE_EVALUATION_DATABASE, EvaluationFactViewService],
    },
    {
      provide: FinalizationService,
      useFactory: (database: Database, facts: EvaluationFactViewService) =>
        new FinalizationService(
          database,
          {
            read: async (input) => ({
              factView: EvaluationFactViewSchema.parse(await facts.read(input)),
              developmentPlanReference: null,
            }),
          },
          databaseAuditWriter as never,
        ),
      inject: [EMPLOYEE_EVALUATION_DATABASE, EvaluationFactViewService],
    },
    {
      provide: EvaluationDiscussionService,
      useFactory: (database: Database) =>
        new EvaluationDiscussionService(database, databaseAuditWriter as never),
      inject: [EMPLOYEE_EVALUATION_DATABASE],
    },
    {
      provide: EvaluationReportReader,
      useFactory: (database: Database) => new EvaluationReportReader(database),
      inject: [EMPLOYEE_EVALUATION_DATABASE],
    },
    {
      provide: EvaluationWordingService,
      useFactory: (database: Database, facts: EvaluationFactViewService) => {
        const router = createDeferredRuntimeAiRouter(() =>
          createRuntimeAiRouter({
            database,
            secretResolver: new EnvironmentAiCredentialSecretResolver(),
          }),
        );
        return new EvaluationWordingService({
          router,
          timeoutMs: 30_000,
          contextReader: {
            read: async (input) => readWordingContext(database, facts, input),
          },
        });
      },
      inject: [EMPLOYEE_EVALUATION_DATABASE, EvaluationFactViewService],
    },
    {
      provide: EvaluationTemplateService,
      useFactory: (database: Database) =>
        new EvaluationTemplateService(
          database,
          new ApiRubricReader(),
          new ApiOrganizationReader(),
          databaseAuditWriter as never,
        ),
      inject: [EMPLOYEE_EVALUATION_DATABASE],
    },
    {
      provide: EmployeeEvaluationCycleService,
      useFactory: (database: Database) =>
        new EmployeeEvaluationCycleService(
          database,
          new ApiEligibilityReader(),
          new ApiOrganizationReader(),
          databaseAuditWriter as never,
        ),
      inject: [EMPLOYEE_EVALUATION_DATABASE],
    },
    EmployeeEvaluationPolicyGuard,
  ],
  exports: [EmployeeEvaluationQueryService],
})(EmployeeEvaluationModule);

class ApiRubricReader {
  async readEvaluationRubric(
    transaction: import("@evaluation/database").DatabaseTransaction,
    id: string,
  ) {
    const rubric = await transaction.rubricVersion.findUnique({
      where: { id },
      include: {
        locales: {
          include: {
            sections: { orderBy: { displayOrder: "asc" } },
            criteria: {
              include: { anchors: { orderBy: { rating: "asc" } } },
              orderBy: { displayOrder: "asc" },
            },
          },
        },
      },
    });
    if (rubric === null) return null;
    return {
      id: rubric.id,
      organizationId: rubric.organizationId,
      version: rubric.version,
      status: rubric.status,
      protectedGlobalCriterionIds: rubric.locales
        .flatMap(({ criteria }) => criteria)
        .filter(({ stableId }) => ["PPB-01", "PPB-02", "PPB-03"].includes(stableId))
        .map(({ stableId }) => stableId),
      locales: rubric.locales.map((locale) => ({
        locale: locale.locale,
        status: locale.status,
        sourceHash: locale.sourceHash,
        sections: locale.sections.map((section) => ({
          id: section.stableId,
          title: section.title,
          weight: section.weight,
        })),
        criteria: locale.criteria.map((criterion) => ({
          id: criterion.stableId,
          title: criterion.title,
          sectionId:
            locale.sections.find(({ id }) => id === criterion.sectionId)?.stableId ?? "PROJECT",
          ...(criterion.internalWeight === null
            ? {}
            : { internalWeight: criterion.internalWeight }),
          anchors: criterion.anchors.map((anchor) => ({
            rating: anchor.rating,
            text: anchor.text,
          })),
        })),
      })),
    };
  }
}

export class ApiOrganizationReader {
  async departmentBelongsToOrganization(
    transaction: import("@evaluation/database").DatabaseTransaction,
    input: Readonly<{ organizationId: string; departmentId: string }>,
  ): Promise<boolean> {
    return (
      (await transaction.department.count({
        where: { id: input.departmentId, organizationId: input.organizationId },
      })) === 1
    );
  }
}

export class ApiEligibilityReader {
  async readCycleEligibility(
    input: Parameters<
      import("@evaluation/employee-evaluation").EligibilitySnapshotReader["readCycleEligibility"]
    >[0],
    transaction: import("@evaluation/database").DatabaseTransaction,
  ): Promise<import("@evaluation/employee-evaluation").CycleEligibilitySnapshot> {
    const snapshot = await transaction.eligibilitySnapshot.findFirst({
      where: {
        cycle: {
          departmentId: input.departmentId,
          effectiveFrom: new Date(input.startsAt),
          effectiveTo: new Date(input.endsAt),
        },
      },
      include: { cycle: true, entries: { orderBy: { position: "asc" } } },
    });
    if (snapshot === null) {
      throw new AppError(
        "EVALUATION_ELIGIBILITY_SNAPSHOT_NOT_FOUND",
        "errors.evaluation.eligibilitySnapshotNotFound",
        409,
      );
    }
    return {
      id: snapshot.id,
      version: snapshot.version,
      managerId: snapshot.cycle.managerId,
      visibilityMode: snapshot.visibilityMode,
      effectiveFrom: snapshot.effectiveFrom.toISOString(),
      effectiveTo: snapshot.effectiveTo.toISOString(),
      entries: snapshot.entries.map((entry) => ({
        employeeId: entry.employeeId,
        state: entry.state,
        sourceReason: entry.sourceReason,
        effectiveFrom: entry.effectiveFrom.toISOString(),
        effectiveTo: entry.effectiveTo.toISOString(),
      })),
    };
  }
}

async function readWordingContext(
  database: Database,
  facts: EvaluationFactViewService,
  input: Readonly<{ assignmentId: string; actorId: string; criterionId: string; locale: "en" }>,
) {
  const assignment = await database.evaluationAssignment.findUnique({
    where: { id: input.assignmentId },
    include: { cycle: { include: { snapshot: true } } },
  });
  if (assignment === null || assignment.cycle.snapshot === null) throw forbidden();
  const access =
    assignment.employeeId === input.actorId
      ? "self"
      : assignment.managerId === input.actorId
        ? "assigned_manager"
        : null;
  if (access === null) throw forbidden();
  const item = await database.evaluationTemplateItem.findUnique({
    where: { id: input.criterionId },
    include: { locales: { where: { locale: "en" } } },
  });
  const locale = item?.locales[0];
  if (
    item === null ||
    item === undefined ||
    locale === undefined ||
    item.versionId !== assignment.cycle.templateVersionId
  ) {
    throw forbidden();
  }
  const factView = await facts.read({
    cycle: {
      id: assignment.cycleId,
      startsAt: assignment.cycle.startsAt.toISOString(),
      endsAt: assignment.cycle.endsAt.toISOString(),
      rubricVersionId: assignment.cycle.snapshot.rubricVersionId,
    },
    subjectEmployeeId: assignment.employeeId,
    requester: {
      actorId: input.actorId,
      subjectEmployeeId: assignment.employeeId,
      access,
      active: true,
    },
  });
  return {
    assignmentId: assignment.id,
    actorId: input.actorId,
    departmentId: assignment.cycle.departmentId,
    systemId: await resolveSystemAiScopeId(database, EVALUATION_JUSTIFICATION_ROUTE),
    criterion: {
      id: item.id,
      locale: "en" as const,
      anchors: locale.anchors as unknown as ReadonlyArray<
        Readonly<{ rating: number; text: string }>
      >,
    },
    factView: EvaluationFactViewSchema.parse(factView),
  };
}

function forbidden() {
  return new AppError("EMPLOYEE_EVALUATION_FORBIDDEN", "errors.evaluation.forbidden", 403);
}

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL must be configured");
  return value;
}
