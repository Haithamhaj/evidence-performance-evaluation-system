/* eslint-disable no-unused-vars */
type DatabaseClient = import("@evaluation/database").DatabaseClient;

export type ManagerCoachingView = Readonly<{
  generatedAt: string;
  boundary: "shared_and_formal_only";
  sharedActions: readonly Readonly<{
    id: string;
    employeeId: string;
    employeeName: string;
    state: string;
    title: string;
    objective: string;
    targetDate: string | null;
    updatedAt: string;
  }>[];
  formalPlans: readonly Readonly<{
    id: string;
    employeeId: string;
    employeeName: string;
    state: string;
    developmentArea: string;
    expectedBehavior: string;
    targetDate: string | null;
    version: number;
    updatedAt: string;
  }>[];
}>;

export interface ManagerCoachingSource {
  load(
    managerId: string,
    at: string,
  ): Promise<Omit<ManagerCoachingView, "generatedAt" | "boundary">>;
}

export class ManagerCoachingQueryService {
  constructor(
    private readonly source: ManagerCoachingSource,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async load(managerId: string): Promise<ManagerCoachingView> {
    const generatedAt = this.clock().toISOString();
    return {
      generatedAt,
      boundary: "shared_and_formal_only",
      ...(await this.source.load(managerId, generatedAt)),
    };
  }
}

export function createDatabaseManagerCoachingQueryService(database: DatabaseClient) {
  return new ManagerCoachingQueryService(new DatabaseManagerCoachingSource(database));
}

class DatabaseManagerCoachingSource implements ManagerCoachingSource {
  constructor(private readonly database: DatabaseClient) {}

  async load(managerId: string, at: string) {
    const instant = new Date(at);
    const assignments = await this.database.evaluationAssignment.findMany({
      where: {
        managerId,
        eligibilityState: "ELIGIBLE",
        employee: { active: true },
        cycle: {
          startsAt: { lte: instant },
          endsAt: { gte: instant },
          state: { notIn: ["CLOSED", "CANCELLED"] },
        },
      },
      select: { employeeId: true },
    });
    const employeeIds = [...new Set(assignments.map(({ employeeId }) => employeeId))];
    const [actions, plans] = await Promise.all([
      employeeIds.length === 0
        ? []
        : this.database.developmentAction.findMany({
            where: {
              employeeId: { in: employeeIds },
              privacy: "SHARED",
              state: { notIn: ["COMPLETED", "CANCELLED", "SUPERSEDED"] },
              currentRevisionId: { not: null },
            },
            select: {
              id: true,
              employeeId: true,
              state: true,
              updatedAt: true,
              employee: { select: { displayName: true } },
              currentRevision: {
                select: { title: true, objective: true, targetDate: true },
              },
            },
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          }),
      this.database.formalDevelopmentPlan.findMany({
        where: {
          managerId,
          state: { notIn: ["COMPLETED", "CLOSED", "WITHDRAWN"] },
          currentRevisionId: { not: null },
        },
        select: {
          id: true,
          employeeId: true,
          state: true,
          version: true,
          updatedAt: true,
          employee: { select: { displayName: true } },
          currentRevision: {
            select: { developmentArea: true, expectedBehavior: true, targetDate: true },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      }),
    ]);
    return {
      sharedActions: actions.flatMap((action) =>
        action.currentRevision === null
          ? []
          : [
              {
                id: action.id,
                employeeId: action.employeeId,
                employeeName: action.employee.displayName,
                state: action.state,
                title: action.currentRevision.title,
                objective: action.currentRevision.objective,
                targetDate: action.currentRevision.targetDate?.toISOString() ?? null,
                updatedAt: action.updatedAt.toISOString(),
              },
            ],
      ),
      formalPlans: plans.flatMap((plan) =>
        plan.currentRevision === null
          ? []
          : [
              {
                id: plan.id,
                employeeId: plan.employeeId,
                employeeName: plan.employee.displayName,
                state: plan.state,
                developmentArea: plan.currentRevision.developmentArea,
                expectedBehavior: plan.currentRevision.expectedBehavior,
                targetDate: plan.currentRevision.targetDate?.toISOString() ?? null,
                version: plan.version,
                updatedAt: plan.updatedAt.toISOString(),
              },
            ],
      ),
    };
  }
}
