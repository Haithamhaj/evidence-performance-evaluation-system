type DatabaseClient = import("@evaluation/database").DatabaseClient;
type TimelineItem = import("@evaluation/contracts").TimelineItem;
type TimelineCursor = Readonly<{ occurredAt: string; kind: TimelineItem["kind"]; id: string }>;

type TimelineInput = Readonly<{
  actorId: string;
  projectId: string;
  workstreamId: string | null;
  limit: number;
  cursor: TimelineCursor | null;
}>;

/** Public Research-owned projection used by Timeline composition. It emits human-confirmed events only. */
export class ResearchTimelineReader {
  readonly #database: DatabaseClient;

  constructor(database: DatabaseClient) {
    this.#database = database;
  }

  async readTimeline(input: TimelineInput): Promise<TimelineItem[]> {
    const client = this.#database as any;
    const scopeWhere = {
      projectId: input.projectId,
      ...(input.workstreamId === null ? {} : { workstreamId: input.workstreamId }),
    };
    const [
      transitions,
      revisions,
      experiments,
      runs,
      experimentConclusions,
      researchConclusions,
      learning,
    ] = await Promise.all([
      callFindMany(client.researchTransition, {
        where: {
          research: scopeWhere,
          toState: { in: ["ACTIVE", "CONCLUDED", "CANCELLED", "SUPERSEDED"] },
        },
        include: { research: scopeInclude() },
        orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
        take: input.limit,
      }),
      callFindMany(client.researchRevision, {
        where: {
          research: { ...scopeWhere, state: { not: "DRAFT" } },
          origin: "EMPLOYEE",
          revision: { gt: 1 },
        },
        include: { research: scopeInclude() },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit,
      }),
      callFindMany(client.experiment, {
        where: {
          research: scopeWhere,
          state: {
            in: ["READY", "RUNNING", "RESULT_RECORDED", "CONCLUDED", "ABANDONED", "SUPERSEDED"],
          },
        },
        include: {
          research: scopeInclude(),
          workstream: { select: { id: true, name: true } },
          workItem: { select: { id: true, title: true } },
        },
        orderBy: [{ transitionedAt: "desc" }, { id: "desc" }],
        take: input.limit,
      }),
      callFindMany(client.experimentRun, {
        where: { experiment: { research: scopeWhere } },
        include: {
          experiment: {
            include: {
              research: scopeInclude(),
              workstream: { select: { id: true, name: true } },
              workItem: { select: { id: true, title: true } },
            },
          },
        },
        orderBy: [{ completedAt: "desc" }, { id: "desc" }],
        take: input.limit,
      }),
      callFindMany(client.experimentConclusion, {
        where: { experiment: { research: scopeWhere } },
        include: {
          experiment: {
            include: {
              research: scopeInclude(),
              workstream: { select: { id: true, name: true } },
              workItem: { select: { id: true, title: true } },
            },
          },
        },
        orderBy: [{ confirmedAt: "desc" }, { id: "desc" }],
        take: input.limit,
      }),
      callFindMany(client.researchConclusion, {
        where: { research: scopeWhere },
        include: { research: scopeInclude() },
        orderBy: [{ confirmedAt: "desc" }, { id: "desc" }],
        take: input.limit,
      }),
      callFindMany(client.appliedLearning, {
        where: { research: scopeWhere },
        include: { research: scopeInclude() },
        orderBy: [{ confirmedAt: "desc" }, { id: "desc" }],
        take: input.limit,
      }),
    ]);

    const items: TimelineItem[] = [
      ...transitions.map((row: any) =>
        researchItem(
          row,
          row.research,
          row.effectiveAt,
          stateTitle("research", row.toState),
          row.reason ?? row.toState,
          row.actorId,
        ),
      ),
      ...revisions.map((row: any) =>
        researchItem(
          row,
          row.research,
          row.createdAt,
          "Research revised",
          row.question,
          row.authorId,
        ),
      ),
      ...experiments.map((row: any) =>
        experimentItem(
          row,
          row,
          row.transitionedAt,
          stateTitle("experiment", row.state),
          row.title,
          null,
        ),
      ),
      ...runs.map((row: any) =>
        experimentItem(
          row,
          row.experiment,
          row.completedAt,
          "Experiment run recorded",
          row.executionNotes,
          row.executorId,
        ),
      ),
      ...experimentConclusions.map((row: any) =>
        experimentItem(
          row,
          row.experiment,
          row.confirmedAt,
          "Experiment conclusion",
          row.summary,
          row.confirmerId,
        ),
      ),
      ...researchConclusions.map((row: any) =>
        researchItem(
          row,
          row.research,
          row.confirmedAt,
          "Research decision",
          `${row.answer} — ${row.decision}`,
          row.confirmerId,
        ),
      ),
      ...learning.map((row: any) =>
        researchItem(
          row,
          row.research,
          row.confirmedAt,
          "Applied learning",
          `${row.whatChanged} — ${row.causalRationale}`,
          row.confirmerId,
          "applied_learning",
        ),
      ),
    ];
    return items
      .filter((item) => input.cursor === null || follows(item, input.cursor))
      .sort(compare)
      .slice(0, input.limit);
  }
}

async function callFindMany(delegate: any, args: unknown): Promise<any[]> {
  if (delegate?.findMany === undefined) return [];
  return delegate.findMany(args);
}

function scopeInclude() {
  return {
    include: {
      project: { select: { id: true, name: true } },
      workstream: { select: { id: true, name: true } },
      workItem: { select: { id: true, title: true } },
    },
  };
}

function researchItem(
  row: any,
  research: any,
  at: Date,
  title: string,
  detail: string,
  employeeId: string | null,
  kind: "research" | "applied_learning" = "research",
): TimelineItem {
  return baseItem(row.id, kind, research, at, title, detail, employeeId, `${kind}:${row.id}`);
}

function experimentItem(
  row: any,
  experiment: any,
  at: Date,
  title: string,
  detail: string,
  employeeId: string | null,
): TimelineItem {
  const research = experiment.research;
  return baseItem(
    row.id,
    "experiment",
    {
      ...research,
      workstreamId: experiment.workstreamId,
      workItemId: experiment.workItemId,
      workstream: experiment.workstream,
      workItem: experiment.workItem,
    },
    at,
    title,
    detail,
    employeeId,
    `experiment:${row.id}`,
  );
}

function baseItem(
  id: string,
  kind: "research" | "experiment" | "applied_learning",
  scope: any,
  at: Date,
  title: string,
  detail: string,
  employeeId: string | null,
  sourceReference: string,
): TimelineItem {
  return {
    id,
    kind,
    projectId: scope.projectId,
    workstreamId: scope.workstreamId ?? null,
    workItemId: scope.workItemId ?? null,
    employeeId,
    occurredAt: at.toISOString(),
    title,
    detail,
    sourceReferences: [sourceReference],
    sourceProvenance: "human_decision",
    reviewState: "human_decision",
    project: scope.project,
    workstream: scope.workstream ?? null,
    workItem: scope.workItem ?? null,
    relatedKpiComponents: [],
    relatedCriteria: [],
    verificationState: null,
    decisionOutcome: null,
  };
}

function stateTitle(kind: "research" | "experiment", state: string): string {
  return `${kind === "research" ? "Research" : "Experiment"} ${state.toLowerCase().replaceAll("_", " ")}`;
}

function compare(left: TimelineItem, right: TimelineItem): number {
  return (
    right.occurredAt.localeCompare(left.occurredAt) ||
    right.kind.localeCompare(left.kind) ||
    right.id.localeCompare(left.id)
  );
}

function follows(item: TimelineItem, cursor: TimelineCursor): boolean {
  return (
    item.occurredAt < cursor.occurredAt ||
    (item.occurredAt === cursor.occurredAt &&
      (item.kind < cursor.kind || (item.kind === cursor.kind && item.id < cursor.id)))
  );
}
