import { AppError } from "@evaluation/contracts";
import { CheckInService } from "@evaluation/updates-evidence";

type DatabaseClient = import("@evaluation/database").DatabaseClient;

export type MonthlyReadinessGapKind = "silent_active_scope" | "artifact_criterion_without_source";

type Project = Readonly<{ id: string; name: string }>;
type Scope = Readonly<{
  id: string;
  kind: "project" | "workstream";
  name: string;
}>;

export interface ReadinessQuerySource {
  loadEmployeeMonth(input: {
    employeeId: string;
    projectId: string;
    startsAt: string;
    endsAt: string;
  }): Promise<
    Readonly<{
      project: Project;
      scopes: readonly Scope[];
      substantiveScopeIds: readonly string[];
      evidenceScopeIds: readonly string[];
      artifactRequiredScopeIds: readonly string[];
    }>
  >;
  loadManagerProjectMonth?(input: {
    managerId: string;
    projectId: string;
    startsAt: string;
    endsAt: string;
  }): Promise<Readonly<{ project: Project; gapKinds: readonly MonthlyReadinessGapKind[] }>>;
}

export class ReadinessQueryService {
  private readonly source: ReadinessQuerySource;

  constructor(source: ReadinessQuerySource) {
    this.source = source;
  }

  async employeeProjectMonth(employeeId: string, projectId: string, at = new Date()) {
    const month = monthWindow(at);
    const source = await this.source.loadEmployeeMonth({
      employeeId,
      projectId,
      startsAt: month.startsAt.toISOString(),
      endsAt: month.endsAt.toISOString(),
    });
    const substantive = new Set(source.substantiveScopeIds);
    const evidence = new Set(source.evidenceScopeIds);
    const artifactRequired = new Set(source.artifactRequiredScopeIds);
    const gaps = source.scopes.flatMap((scope) => {
      const result: Array<{
        kind: MonthlyReadinessGapKind;
        scopeId: string;
        scopeKind: Scope["kind"];
        scopeName: string;
        correctiveAction: "add_substantive_update" | "attach_source";
      }> = [];
      if (!substantive.has(scope.id)) {
        result.push({
          kind: "silent_active_scope",
          scopeId: scope.id,
          scopeKind: scope.kind,
          scopeName: scope.name,
          correctiveAction: "add_substantive_update",
        });
      }
      if (artifactRequired.has(scope.id) && !evidence.has(scope.id)) {
        result.push({
          kind: "artifact_criterion_without_source",
          scopeId: scope.id,
          scopeKind: scope.kind,
          scopeName: scope.name,
          correctiveAction: "attach_source",
        });
      }
      return result;
    });
    return {
      project: source.project,
      month: month.key,
      state: gaps.length === 0 ? ("clear" as const) : ("attention" as const),
      messageKey: "readiness.recordMayBeInsufficient" as const,
      gaps,
    };
  }

  async managerProjectMonth(managerId: string, projectId: string, at = new Date()) {
    if (this.source.loadManagerProjectMonth === undefined) {
      throw new Error("Manager readiness source is not configured");
    }
    const month = monthWindow(at);
    const source = await this.source.loadManagerProjectMonth({
      managerId,
      projectId,
      startsAt: month.startsAt.toISOString(),
      endsAt: month.endsAt.toISOString(),
    });
    return {
      project: source.project,
      month: month.key,
      state: source.gapKinds.length === 0 ? ("clear" as const) : ("attention" as const),
      gapKinds: [...new Set(source.gapKinds)],
    };
  }
}

export function createDatabaseCheckInService(
  client: DatabaseClient,
  leaves: import("@evaluation/updates-evidence").ApprovedLeaveExemptionReader = {
    findApprovedLeave: async () => null,
  },
) {
  return new CheckInService(
    {
      listWorkstreamResponsibilities: async ({ employeeId, startsAt, endsAt }) => {
        const rows = await client.responsibilityWindow.findMany({
          where: {
            employeeId,
            workstreamId: { not: null },
            responsibilityType: { in: ["original", "acting", "permanent"] },
            startsAt: { lt: new Date(endsAt) },
            OR: [{ endsAt: null }, { endsAt: { gt: new Date(startsAt) } }],
          },
          select: {
            projectId: true,
            workstreamId: true,
            startsAt: true,
            endsAt: true,
            project: { select: { name: true } },
            workstream: { select: { name: true } },
          },
          orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        });
        return rows.flatMap((row) =>
          row.projectId === null || row.workstreamId === null || row.workstream === null
            ? []
            : [
                {
                  projectId: row.projectId,
                  projectName: row.project?.name ?? "Project",
                  workstreamId: row.workstreamId,
                  workstreamName: row.workstream.name,
                  startsAt: row.startsAt,
                  endsAt: row.endsAt,
                },
              ],
        );
      },
    },
    {
      hasSubstantiveAcceptedUpdate: async ({ employeeId, workstreamId, startsAt, endsAt }) =>
        (await client.acceptedUpdateEvent.findFirst({
          where: {
            employeeId,
            workstreamId,
            occurredAt: { gte: new Date(startsAt), lt: new Date(endsAt) },
          },
          select: { id: true },
        })) !== null,
    },
    leaves,
  );
}

export function createDatabaseReadinessQueryService(client: DatabaseClient) {
  return new ReadinessQueryService(new DatabaseReadinessSource(client));
}

class DatabaseReadinessSource implements ReadinessQuerySource {
  private readonly client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
  }

  async loadEmployeeMonth(input: {
    employeeId: string;
    projectId: string;
    startsAt: string;
    endsAt: string;
  }) {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    const [project, responsibilities, memberships, updates, evidence, contracts] =
      await Promise.all([
        this.client.project.findFirst({
          where: {
            id: input.projectId,
            OR: [
              {
                members: {
                  some: {
                    employeeId: input.employeeId,
                    startsAt: { lt: endsAt },
                    OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
                  },
                },
              },
              {
                responsibilities: {
                  some: {
                    employeeId: input.employeeId,
                    startsAt: { lt: endsAt },
                    OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
                  },
                },
              },
            ],
          },
          select: { id: true, name: true },
        }),
        this.client.responsibilityWindow.findMany({
          where: {
            employeeId: input.employeeId,
            projectId: input.projectId,
            startsAt: { lt: endsAt },
            OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
          },
          select: {
            workstreamId: true,
            workstream: { select: { name: true } },
          },
        }),
        this.client.workstreamMember.findMany({
          where: {
            employeeId: input.employeeId,
            workstream: { projectId: input.projectId },
            startsAt: { lt: endsAt },
            OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
          },
          select: { workstreamId: true, workstream: { select: { name: true } } },
        }),
        this.client.acceptedUpdateEvent.findMany({
          where: {
            employeeId: input.employeeId,
            projectId: input.projectId,
            occurredAt: { gte: startsAt, lt: endsAt },
          },
          select: { workstreamId: true },
        }),
        this.client.evidenceRecord.findMany({
          where: {
            employeeId: input.employeeId,
            projectId: input.projectId,
            state: "confirmed",
            confirmation: { confirmedAt: { gte: startsAt, lt: endsAt } },
          },
          select: { workstreamId: true },
        }),
        this.client.progressContract.findMany({
          where: { projectId: input.projectId, state: "active", effectiveAt: { lt: endsAt } },
          select: {
            workstreamId: true,
            components: { select: { requiredEvidence: true } },
          },
        }),
      ]);
    if (project === null) {
      throw new AppError("RESOURCE_NOT_FOUND", "errors.notFound", 404);
    }
    const scopes = uniqueScopes([
      { id: project.id, kind: "project" as const, name: project.name },
      ...[...responsibilities, ...memberships].flatMap((row) =>
        row.workstreamId === null || row.workstream === null
          ? []
          : [
              {
                id: row.workstreamId,
                kind: "workstream" as const,
                name: row.workstream.name,
              },
            ],
      ),
    ]);
    const scopeId = (workstreamId: string | null) => workstreamId ?? project.id;
    return {
      project,
      scopes,
      substantiveScopeIds: updates.map((item) => scopeId(item.workstreamId)),
      evidenceScopeIds: evidence.map((item) => scopeId(item.workstreamId)),
      artifactRequiredScopeIds: contracts.flatMap((contract) =>
        contract.components.some(
          (component) =>
            Array.isArray(component.requiredEvidence) && component.requiredEvidence.length > 0,
        )
          ? [scopeId(contract.workstreamId)]
          : [],
      ),
    };
  }
}

function uniqueScopes(scopes: readonly Scope[]): Scope[] {
  return [...new Map(scopes.map((scope) => [`${scope.kind}:${scope.id}`, scope])).values()];
}

function monthWindow(at: Date) {
  if (!Number.isFinite(at.getTime())) throw new Error("Readiness clock returned an invalid date");
  const startsAt = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const endsAt = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
  return { key: startsAt.toISOString().slice(0, 7), startsAt, endsAt };
}
