import {
  ResearchEvaluationFactSchema,
  ResponsibilityWindowFactSchema,
} from "@evaluation/contracts";

const RETRACTION_EVENT_SCHEMA = "research-source-retraction.v1";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type EvaluationSourceReadInput = Readonly<{
  cycleId: string;
  subjectEmployeeId: string;
  cycleStart: string;
  cycleEnd: string;
  requester: Readonly<{
    actorId: string;
    subjectEmployeeId: string;
    access: "self" | "assigned_manager";
    active: true;
  }>;
}>;

/** Research-owned Fact View projection. AI drafts and private source reviews are never selected. */
export class ResearchEvaluationFactReader {
  readonly #database: DatabaseClient;

  constructor(database: DatabaseClient) {
    this.#database = database;
  }

  async readAuthorizedFacts(input: EvaluationSourceReadInput) {
    const client = this.#database as any;
    const startsAt = new Date(input.cycleStart);
    const endsAt = new Date(input.cycleEnd);
    const [records, windows] = await Promise.all([
      client.researchRecord.findMany({
        where: {
          state: { notIn: ["DRAFT", "CANCELLED", "SUPERSEDED"] },
          OR: [
            { ownerId: input.subjectEmployeeId },
            {
              participantEvents: {
                some: { employeeId: input.subjectEmployeeId, action: "STARTED" },
              },
            },
          ],
          createdAt: { lte: endsAt },
        },
        include: {
          revisions: { where: { origin: "EMPLOYEE" }, orderBy: { revision: "asc" } },
          sourceReferences: { orderBy: { createdAt: "asc" } },
          participantEvents: { orderBy: [{ effectiveAt: "asc" }, { id: "asc" }] },
          experiments: {
            where: { state: { notIn: ["DRAFT", "SUPERSEDED"] } },
            include: {
              methodRevisions: { where: { origin: "EMPLOYEE" }, orderBy: { revision: "asc" } },
              runs: { orderBy: { completedAt: "asc" } },
              conclusions: { orderBy: { confirmedAt: "asc" } },
            },
          },
          researchConclusions: { orderBy: { confirmedAt: "asc" } },
          appliedLearning: { orderBy: { confirmedAt: "asc" } },
        },
      }),
      client.responsibilityWindow.findMany({
        where: {
          employeeId: input.subjectEmployeeId,
          startsAt: { lte: endsAt },
          OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
        },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      }),
    ]);
    const responsibilityWindows = (windows as any[]).map(projectWindow);
    const facts: import("@evaluation/contracts").ResearchEvaluationFact[] = [];
    for (const root of records as any[]) {
      const retractedSourceIds = new Set(
        (root.sourceReferences ?? [])
          .filter(({ state }: any) => state === "RETRACTED")
          .map(({ citedLocations }: any) => retractionPredecessor(citedLocations))
          .filter((id: string | null): id is string => id !== null),
      );
      for (const revision of root.revisions ?? []) {
        pushIfInside(
          facts,
          input,
          researchFact(
            root,
            revision.id,
            revision.createdAt,
            "research_question",
            revision.question,
            stringArray(revision.knownUncertainty),
            null,
            "research_revision",
            revision.revision,
            responsibilityWindows,
          ),
          root,
        );
      }
      for (const source of root.sourceReferences ?? []) {
        if (source.state !== "ACTIVE" || retractedSourceIds.has(source.id)) continue;
        pushIfInside(
          facts,
          input,
          researchFact(
            root,
            source.id,
            source.createdAt,
            "source_synthesis",
            `${source.title}: ${source.relevanceNote}`,
            [],
            source.credibilityNote,
            "research_source",
            null,
            responsibilityWindows,
            source.canonicalUrl,
          ),
          root,
        );
      }
      for (const experiment of root.experiments ?? []) {
        const scoped = {
          ...root,
          workstreamId: experiment.workstreamId ?? root.workstreamId,
          workItemId: experiment.workItemId ?? root.workItemId,
        };
        for (const method of experiment.methodRevisions ?? []) {
          pushIfInside(
            facts,
            input,
            researchFact(
              scoped,
              method.id,
              method.createdAt,
              "experiment_method",
              method.question,
              stringArray(method.knownRisks),
              method.baselineDescription,
              "experiment_method",
              method.revision,
              responsibilityWindows,
            ),
            root,
          );
        }
        for (const run of experiment.runs ?? []) {
          pushIfInside(
            facts,
            input,
            researchFact(
              scoped,
              run.id,
              run.completedAt,
              "experiment_run",
              run.executionNotes,
              stringArray(run.unexpectedConditions),
              null,
              "experiment_run",
              run.sequence,
              responsibilityWindows,
            ),
            root,
          );
        }
        for (const conclusion of experiment.conclusions ?? []) {
          pushIfInside(
            facts,
            input,
            researchFact(
              scoped,
              conclusion.id,
              conclusion.confirmedAt,
              "experiment_conclusion",
              conclusion.summary,
              stringArray(conclusion.limitations),
              conclusion.confidenceDescription,
              "experiment_conclusion",
              null,
              responsibilityWindows,
            ),
            root,
          );
        }
      }
      for (const conclusion of root.researchConclusions ?? []) {
        pushIfInside(
          facts,
          input,
          researchFact(
            root,
            conclusion.id,
            conclusion.confirmedAt,
            "research_decision",
            `${conclusion.answer} — ${conclusion.decision}`,
            stringArray(conclusion.remainingUncertainty),
            conclusion.rationale,
            "research_conclusion",
            null,
            responsibilityWindows,
          ),
          root,
        );
      }
      for (const learning of root.appliedLearning ?? []) {
        pushIfInside(
          facts,
          input,
          researchFact(
            root,
            learning.id,
            learning.confirmedAt,
            "applied_learning",
            learning.whatChanged,
            [],
            learning.causalRationale,
            "applied_learning",
            null,
            responsibilityWindows,
          ),
          root,
        );
      }
    }
    return {
      responsibilityWindows,
      researchFacts: facts.sort(
        (left, right) =>
          left.sourceOccurredAt.localeCompare(right.sourceOccurredAt) ||
          left.sourceId.localeCompare(right.sourceId),
      ),
      employeeInterpretations: [],
    };
  }
}

function researchFact(
  root: any,
  sourceId: string,
  occurredAt: Date,
  factType: import("@evaluation/contracts").ResearchEvaluationFact["factType"],
  summary: string,
  limitations: string[],
  uncertainty: string | null,
  sourceType: import("@evaluation/contracts").EvaluationFactSourceReference["sourceType"],
  sourceVersion: number | null,
  windows: readonly import("@evaluation/contracts").ResponsibilityWindowFact[],
  url: string | null = null,
): import("@evaluation/contracts").ResearchEvaluationFact {
  const instant = occurredAt.toISOString();
  return ResearchEvaluationFactSchema.parse({
    kind: "source_fact",
    sourceType: "research",
    factType,
    sourceId,
    sourceOccurredAt: instant,
    projectId: root.projectId,
    workstreamId: root.workstreamId ?? null,
    relatedWorkItemId: root.workItemId ?? null,
    sourceReferences: [{ sourceType, sourceId, sourceVersion, occurredAt: instant, url }],
    humanConfirmationState:
      factType === "research_decision" || factType === "applied_learning"
        ? "human_decision"
        : "employee_confirmed",
    verificationState: "source_supported",
    responsibilityWindowIds: windows
      .filter((window) => applies(window, root, occurredAt))
      .map(({ sourceId: id }) => id),
    summary,
    limitations,
    uncertainty,
  });
}

function projectWindow(row: any): import("@evaluation/contracts").ResponsibilityWindowFact {
  const startedAt = row.startsAt.toISOString();
  return ResponsibilityWindowFactSchema.parse({
    kind: "source_fact",
    sourceType: "responsibility_window",
    sourceId: row.id,
    sourceOccurredAt: startedAt,
    projectId: row.projectId,
    workstreamId: row.workstreamId ?? null,
    responsibilityType:
      (
        {
          original: "original_owner",
          acting: "acting_owner",
          permanent: "permanent_owner",
          contributor: "contributor",
        } as const
      )[row.responsibilityType as "original" | "acting" | "permanent" | "contributor"] ??
      "contributor",
    startedAt,
    endedAt: row.endsAt?.toISOString() ?? null,
    sourceReferences: [
      {
        sourceType: "responsibility_window",
        sourceId: row.id,
        sourceVersion: null,
        occurredAt: startedAt,
        url: null,
      },
    ],
  });
}

function applies(
  window: import("@evaluation/contracts").ResponsibilityWindowFact,
  root: any,
  at: Date,
): boolean {
  return (
    window.projectId === root.projectId &&
    (window.workstreamId === null || window.workstreamId === (root.workstreamId ?? null)) &&
    Date.parse(window.startedAt) <= at.getTime() &&
    (window.endedAt === null || at.getTime() < Date.parse(window.endedAt))
  );
}

function pushIfInside(
  facts: import("@evaluation/contracts").ResearchEvaluationFact[],
  input: EvaluationSourceReadInput,
  fact: import("@evaluation/contracts").ResearchEvaluationFact,
  root: any,
): void {
  if (
    fact.sourceOccurredAt >= input.cycleStart &&
    fact.sourceOccurredAt <= input.cycleEnd &&
    isResponsibleAt(root, input.subjectEmployeeId, fact.sourceOccurredAt)
  )
    facts.push(fact);
}

function isResponsibleAt(root: any, subjectEmployeeId: string, occurredAt: string): boolean {
  const events = (root.participantEvents ?? []).filter(
    (event: any) => event.employeeId === subjectEmployeeId,
  );
  if (events.length === 0) return root.ownerId === subjectEmployeeId;
  const activeRoles = new Set<string>();
  for (const event of events) {
    if (event.effectiveAt.toISOString() > occurredAt) break;
    if (event.action === "STARTED") activeRoles.add(event.role);
    else if (event.action === "ENDED") activeRoles.delete(event.role);
  }
  return activeRoles.size > 0;
}

function retractionPredecessor(citedLocations: unknown): string | null {
  if (!Array.isArray(citedLocations) || citedLocations.length !== 1) return null;
  const marker = citedLocations[0];
  if (typeof marker !== "object" || marker === null) return null;
  const candidate = marker as Record<string, unknown>;
  return candidate.schemaVersion === RETRACTION_EVENT_SCHEMA &&
    typeof candidate.predecessorSourceReferenceId === "string"
    ? candidate.predecessorSourceReferenceId
    : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}
