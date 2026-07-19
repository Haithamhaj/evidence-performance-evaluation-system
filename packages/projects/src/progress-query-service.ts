import { AppError } from "@evaluation/contracts";

type DatabaseClient = import("@evaluation/database").DatabaseClient;

export class ProgressQueryService {
  private readonly client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
  }

  async listUpdateScopes(input: Readonly<{ actorId: string }>): Promise<
    ReadonlyArray<
      Readonly<{
        id: string;
        name: string;
        workstreams: ReadonlyArray<Readonly<{ id: string; name: string }>>;
      }>
    >
  > {
    const at = new Date();
    return this.client.project.findMany({
      where: {
        status: { in: ["active", "paused"] },
        members: {
          some: {
            employeeId: input.actorId,
            startsAt: { lte: at },
            OR: [{ endsAt: null }, { endsAt: { gt: at } }],
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        workstreams: {
          where: {
            members: {
              some: {
                employeeId: input.actorId,
                startsAt: { lte: at },
                OR: [{ endsAt: null }, { endsAt: { gt: at } }],
              },
            },
          },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          select: { id: true, name: true },
        },
      },
    });
  }

  async getProjectProgress(
    input: Readonly<{ actorId: string; projectId: string }>,
  ): Promise<unknown> {
    const project = await this.client.project.findFirst({
      where: {
        id: input.projectId,
        OR: [
          { members: { some: { employeeId: input.actorId, endsAt: null } } },
          {
            department: {
              authorizationScopes: {
                some: {
                  roleAssignments: {
                    some: { userId: input.actorId, role: "manager" },
                  },
                },
              },
            },
          },
        ],
      },
      select: { id: true, name: true, description: true, status: true },
    });
    if (project === null)
      throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);

    const contract = await this.client.progressContract.findFirst({
      where: { projectId: project.id, workstreamId: null, state: "active" },
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
      include: {
        components: { orderBy: { position: "asc" } },
        snapshots: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { id: true, percent: true, reason: true, createdAt: true },
        },
      },
    });
    if (contract === null) {
      return { project, contract: null, progress: { state: "awaiting_contract" as const } };
    }
    const snapshot = contract.snapshots[0];
    return {
      project,
      contract: {
        id: contract.id,
        contractVersion: contract.contractVersion,
        version: contract.version,
        state: contract.state,
        calculationKind: contract.calculationKind,
        effectiveAt: contract.effectiveAt.toISOString(),
        components: contract.components.map((component) => ({
          id: component.id,
          kind: component.kind,
          name: component.name,
          description: component.description,
          weight: component.weight === null ? null : Number(component.weight),
          baseline: component.baseline === null ? null : Number(component.baseline),
          target: component.target === null ? null : Number(component.target),
          unit: component.unit,
          direction: component.direction,
          requiredEvidence: component.requiredEvidence,
        })),
      },
      progress:
        snapshot === undefined
          ? { state: "awaiting_information" as const }
          : {
              state: "accepted" as const,
              snapshotId: snapshot.id,
              percent: Number(snapshot.percent),
              reason: snapshot.reason,
              updatedAt: snapshot.createdAt.toISOString(),
            },
    };
  }

  async listPortfolio(input: Readonly<{ actorId: string }>): Promise<unknown> {
    const projects = await this.client.project.findMany({
      where: {
        members: { some: { employeeId: input.actorId, endsAt: null } },
        status: { in: ["active", "paused"] },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        progressContracts: {
          where: { state: "active", workstreamId: null },
          orderBy: [{ effectiveAt: "desc" }],
          take: 1,
          select: {
            id: true,
            snapshots: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 1,
              select: { percent: true, createdAt: true },
            },
          },
        },
      },
    });
    return projects.map((project) => {
      const contract = project.progressContracts[0];
      const snapshot = contract?.snapshots[0];
      return {
        id: project.id,
        name: project.name,
        status: project.status,
        progress:
          contract === undefined
            ? { state: "awaiting_contract" as const }
            : snapshot === undefined
              ? { state: "awaiting_information" as const }
              : {
                  state: "accepted" as const,
                  percent: Number(snapshot.percent),
                  updatedAt: snapshot.createdAt.toISOString(),
                },
      };
    });
  }
}
