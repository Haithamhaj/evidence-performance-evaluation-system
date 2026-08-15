import { AppError } from "@evaluation/contracts";

type DatabaseClient = import("@evaluation/database").DatabaseClient;

export type ManagerOperationDetailKey =
  | "approval_waiting"
  | "project_paused"
  | "progress_source_ambiguous"
  | "ownership_missing"
  | "commitment_upcoming";

export type ManagerOperationItem = Readonly<{
  id: string;
  projectId: string;
  projectName: string;
  label?: string;
  detailKey: ManagerOperationDetailKey;
  observedAt: string;
  dueAt?: string;
}>;

type QueueProjection = Readonly<{
  approvalsWaiting: readonly ManagerOperationItem[];
  blockedProjects: readonly ManagerOperationItem[];
  ambiguousProgressEvidence: readonly ManagerOperationItem[];
  ownershipGaps: readonly ManagerOperationItem[];
  upcomingCommitments: readonly ManagerOperationItem[];
}>;

export interface ManagerOperationsSource {
  load(input: { managerId: string; at: string }): Promise<QueueProjection>;
}

export class ManagerOperationsQueryService {
  private readonly source: ManagerOperationsSource;
  private readonly clock: () => Date;

  constructor(source: ManagerOperationsSource, clock: () => Date = () => new Date()) {
    this.source = source;
    this.clock = clock;
  }

  async load(managerId: string) {
    const at = this.clock();
    if (!Number.isFinite(at.getTime())) throw new Error("Manager operations clock is invalid");
    const queues = await this.source.load({ managerId, at: at.toISOString() });
    return {
      ...queues,
      generatedAt: at.toISOString(),
      readinessHref: "/manager/readiness" as const,
      evaluationHref: "/manager/evaluations" as const,
      continuityHref: "/continuity" as const,
    };
  }
}

export function createDatabaseManagerOperationsQueryService(client: DatabaseClient) {
  return new ManagerOperationsQueryService(new DatabaseManagerOperationsSource(client));
}

class DatabaseManagerOperationsSource implements ManagerOperationsSource {
  private readonly client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
  }

  async load(input: { managerId: string; at: string }): Promise<QueueProjection> {
    const at = new Date(input.at);
    const assignments = await this.client.roleAssignment.findMany({
      where: { userId: input.managerId, role: "manager", scopeType: "department" },
      select: { scope: { select: { departmentId: true } } },
    });
    const departmentIds = assignments.flatMap(({ scope }) =>
      scope.departmentId === null ? [] : [scope.departmentId],
    );
    if (departmentIds.length === 0) {
      throw new AppError("AUTH_FORBIDDEN", "errors.forbidden", 403);
    }
    const soon = new Date(at.getTime() + 14 * 86_400_000);
    const [approvals, blocked, ambiguous, ownershipGaps, commitments] = await Promise.all([
      this.client.progressContract.findMany({
        where: {
          state: "pending_approval",
          ownerId: input.managerId,
          project: { departmentId: { in: departmentIds } },
        },
        select: { id: true, projectId: true, createdAt: true, project: { select: { name: true } } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      this.client.project.findMany({
        where: { departmentId: { in: departmentIds }, status: "paused" },
        select: { id: true, name: true, updatedAt: true },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      }),
      this.client.progressRecalculationRequest.findMany({
        where: {
          contractId: { not: null },
          contract: {
            state: "active",
            project: { departmentId: { in: departmentIds } },
          },
        },
        select: {
          id: true,
          state: true,
          createdAt: true,
          contract: {
            select: { projectId: true, project: { select: { name: true } } },
          },
        },
        orderBy: [{ contractId: "asc" }, { createdAt: "desc" }, { id: "desc" }],
        distinct: ["contractId"],
      }),
      this.client.project.findMany({
        where: {
          departmentId: { in: departmentIds },
          status: "active",
          responsibilities: {
            none: {
              responsibilityType: { in: ["original", "acting", "permanent"] },
              startsAt: { lte: at },
              OR: [{ endsAt: null }, { endsAt: { gt: at } }],
            },
          },
        },
        select: { id: true, name: true, updatedAt: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      this.client.workItem.findMany({
        where: {
          project: { departmentId: { in: departmentIds } },
          status: { notIn: ["done", "cancelled"] },
          dueAt: { gte: at, lt: soon },
        },
        select: {
          id: true,
          projectId: true,
          title: true,
          dueAt: true,
          updatedAt: true,
          project: { select: { name: true } },
        },
        orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      }),
    ]);
    return {
      approvalsWaiting: approvals.map((item) => ({
        id: item.id,
        projectId: item.projectId,
        projectName: item.project.name,
        detailKey: "approval_waiting",
        observedAt: item.createdAt.toISOString(),
      })),
      blockedProjects: blocked.map((project) => ({
        id: project.id,
        projectId: project.id,
        projectName: project.name,
        detailKey: "project_paused",
        observedAt: project.updatedAt.toISOString(),
      })),
      ambiguousProgressEvidence: uniqueProjects(
        ambiguous.flatMap((item) =>
          item.contract === null || !["pending", "failed"].includes(item.state)
            ? []
            : [
                {
                  id: item.id,
                  projectId: item.contract.projectId,
                  projectName: item.contract.project.name,
                  detailKey: "progress_source_ambiguous" as const,
                  observedAt: item.createdAt.toISOString(),
                },
              ],
        ),
      ),
      ownershipGaps: ownershipGaps.map((project) => ({
        id: project.id,
        projectId: project.id,
        projectName: project.name,
        detailKey: "ownership_missing",
        observedAt: project.updatedAt.toISOString(),
      })),
      upcomingCommitments: commitments.map((item) => ({
        id: item.id,
        projectId: item.projectId,
        projectName: item.project.name,
        label: item.title,
        detailKey: "commitment_upcoming",
        observedAt: item.updatedAt.toISOString(),
        ...(item.dueAt === null ? {} : { dueAt: item.dueAt.toISOString() }),
      })),
    };
  }
}

function uniqueProjects(items: readonly ManagerOperationItem[]): ManagerOperationItem[] {
  return [...new Map(items.map((item) => [item.projectId, item])).values()];
}
