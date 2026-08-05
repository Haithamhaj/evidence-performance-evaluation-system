import { CriterionVersionFactSchema } from "@evaluation/contracts";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type EmployeeEvaluationScopeReader = import("@evaluation/projects").EmployeeEvaluationScopeReader;
type EvaluationSourceReadInput = Readonly<{
  subjectEmployeeId: string;
  cycleStart: string;
  cycleEnd: string;
}>;

export class CriteriaEvaluationFactReader {
  private readonly database: DatabaseClient;
  private readonly scopes: EmployeeEvaluationScopeReader;

  constructor(database: DatabaseClient, scopes: EmployeeEvaluationScopeReader) {
    this.database = database;
    this.scopes = scopes;
  }

  async readAuthorizedFacts(input: EvaluationSourceReadInput): Promise<
    Readonly<{
      dynamicCriteriaVersions: readonly import("@evaluation/contracts").CriterionVersionFact[];
    }>
  > {
    const scopes = await this.scopes.readEmployeeScopes(input);
    if (scopes.projectIds.length === 0 && scopes.workstreamIds.length === 0) {
      return { dynamicCriteriaVersions: [] };
    }
    const sets = await this.database.dynamicCriteriaSet.findMany({
      where: {
        OR: [
          ...(scopes.projectIds.length === 0
            ? []
            : [{ projectId: { in: [...scopes.projectIds] } }]),
          ...(scopes.workstreamIds.length === 0
            ? []
            : [{ workstreamId: { in: [...scopes.workstreamIds] } }]),
        ],
        effectiveFrom: { lte: new Date(input.cycleEnd) },
        AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date(input.cycleStart) } }] }],
      },
      orderBy: [{ effectiveFrom: "asc" }, { id: "asc" }],
      select: {
        id: true,
        projectId: true,
        workstreamId: true,
        workstream: { select: { projectId: true } },
        version: true,
        sourceDocumentVersionId: true,
        effectiveFrom: true,
        effectiveTo: true,
        criteria: {
          orderBy: [{ position: "asc" }, { id: "asc" }],
          select: { id: true, position: true, name: true },
        },
      },
    });

    return {
      dynamicCriteriaVersions: sets.flatMap((set) => {
        const projectId = set.projectId ?? set.workstream?.projectId;
        if (projectId === undefined) throw new Error("Dynamic criteria set has no project scope");
        return set.criteria.map((criterion) =>
          CriterionVersionFactSchema.parse({
            kind: "source_fact",
            sourceType: "criterion_version",
            sourceId: criterion.id,
            sourceOccurredAt: set.effectiveFrom.toISOString(),
            projectId,
            workstreamId: set.workstreamId,
            criterionStableId: stableId(set, criterion.position),
            criterionVersionId: criterion.id,
            locale: "en",
            name: criterion.name,
            effectiveFrom: set.effectiveFrom.toISOString(),
            effectiveUntil: set.effectiveTo?.toISOString() ?? null,
            sourceReferences: [
              {
                sourceType: "criterion_version",
                sourceId: criterion.id,
                sourceVersion: set.version,
                occurredAt: set.effectiveFrom.toISOString(),
                url: null,
              },
              {
                sourceType: "document_version",
                sourceId: set.sourceDocumentVersionId,
                sourceVersion: null,
                occurredAt: set.effectiveFrom.toISOString(),
                url: null,
              },
            ],
          }),
        );
      }),
    };
  }
}

function stableId(
  set: Readonly<{ projectId: string | null; workstreamId: string | null }>,
  position: number,
): string {
  const kind = set.workstreamId === null ? "project" : "workstream";
  const resourceId = set.workstreamId ?? set.projectId;
  if (resourceId === null) throw new Error("Dynamic criteria set has no resource scope");
  return `${kind}:${resourceId}:position:${position}`;
}
