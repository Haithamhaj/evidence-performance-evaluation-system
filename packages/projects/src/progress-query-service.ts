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
          take: 2,
          select: {
            id: true,
            previousPercent: true,
            percent: true,
            reason: true,
            componentState: true,
            createdAt: true,
            sources: {
              select: {
                componentId: true,
                sourceKind: true,
                sourceId: true,
                sourceVersion: true,
                measuredValue: true,
                observedAt: true,
              },
            },
          },
        },
        recalculationRequests: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { state: true, createdAt: true },
        },
      },
    });
    if (contract === null) {
      return {
        project,
        contract: null,
        progress: { state: "awaiting_contract" as const },
        pulse: emptyPulse(),
        pendingChange: null,
      };
    }
    const snapshot = contract.snapshots[0];
    const pulse = projectPulse(contract, snapshot);
    const latestRequest = contract.recalculationRequests[0];
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
      pulse,
      pendingChange:
        latestRequest === undefined || latestRequest.state === "completed"
          ? null
          : {
              state: latestRequest.state,
              requestedAt: latestRequest.createdAt.toISOString(),
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

function emptyPulse() {
  return {
    officialProgress: null,
    previousOfficialProgress: null,
    sourceCoverage: "INSUFFICIENT" as const,
    milestoneStates: [],
    nextRequiredEvidence: [],
    explanation: [],
  };
}

function projectPulse(contract: any, snapshot: any) {
  if (snapshot === undefined) {
    return {
      ...emptyPulse(),
      milestoneStates: contract.components.map((component: any) => ({
        componentId: component.id,
        name: component.name,
        kind: component.kind,
        percent: null,
        state: "awaiting_evidence" as const,
      })),
      nextRequiredEvidence: contract.components.flatMap((component: any) =>
        strings(component.requiredEvidence).map((label) => ({
          componentId: component.id,
          componentName: component.name,
          label,
        })),
      ),
    };
  }
  const latestRequest = contract.recalculationRequests[0];
  const sourceCoverage =
    latestRequest !== undefined &&
    latestRequest.state !== "completed" &&
    latestRequest.createdAt > snapshot.createdAt
      ? ("INSUFFICIENT" as const)
      : ("SUFFICIENT" as const);
  const componentPercent = componentPercentages(snapshot.componentState);
  const sourcedComponents = new Set(
    snapshot.sources.map((source: { componentId: string }) => source.componentId),
  );
  const measuredSources = new Map(
    snapshot.sources
      .filter(
        (source: { componentId: string; sourceKind: string; measuredValue?: unknown }) =>
          source.sourceKind === "kpi_measurement" && source.measuredValue !== null,
      )
      .map((source: { componentId: string; measuredValue: unknown; observedAt?: Date | null }) => [
        source.componentId,
        {
          measuredValue: Number(source.measuredValue),
          observedAt: source.observedAt?.toISOString() ?? snapshot.createdAt.toISOString(),
        },
      ]),
  );
  const milestoneStates = contract.components.map((component: any) => {
    const percent = componentPercent.get(component.id) ?? null;
    const measured = measuredSources.get(component.id);
    return {
      componentId: component.id,
      name: component.name,
      kind: component.kind,
      percent,
      ...(measured === undefined ? {} : measured),
      state:
        !sourcedComponents.has(component.id) && sourceCoverage === "INSUFFICIENT"
          ? ("awaiting_evidence" as const)
          : percent === null || percent === 0
            ? ("not_started" as const)
            : percent >= 100
              ? ("complete" as const)
              : ("in_progress" as const),
    };
  });
  const nextRequiredEvidence = contract.components.flatMap((component: any) =>
    sourcedComponents.has(component.id)
      ? []
      : strings(component.requiredEvidence).map((label) => ({
          componentId: component.id,
          componentName: component.name,
          label,
        })),
  );
  const officialProgress = Number(snapshot.percent);
  const previousOfficialProgress = Number(snapshot.previousPercent);
  const delta = officialProgress - previousOfficialProgress;
  return {
    officialProgress,
    previousOfficialProgress,
    sourceCoverage,
    milestoneStates,
    nextRequiredEvidence,
    explanation: [
      {
        kind:
          delta < 0
            ? ("decrease" as const)
            : delta > 0
              ? ("increase" as const)
              : ("no_change" as const),
        delta,
        text: snapshot.reason,
        snapshotId: snapshot.id,
        observedAt: snapshot.createdAt.toISOString(),
      },
    ],
  };
}

function componentPercentages(value: unknown): Map<string, number> {
  const result = new Map<string, number>();
  if (!Array.isArray(value)) return result;
  for (const item of value) {
    if (
      typeof item === "object" &&
      item !== null &&
      "componentId" in item &&
      typeof item.componentId === "string" &&
      "percent" in item &&
      typeof item.percent === "number" &&
      Number.isFinite(item.percent)
    ) {
      result.set(item.componentId, item.percent);
    }
  }
  return result;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}
