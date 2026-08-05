import {
  CheckInFactSchema,
  ConfirmedEvidenceFactSchema,
  CriterionVersionFactSchema,
  EmployeeInterpretationSchema,
  ProjectContributionFactSchema,
  ResponsibilityWindowFactSchema,
  SourceCoverageNoteSchema,
  type CheckInFact,
  type ConfirmedEvidenceFact,
  type CriterionVersionFact,
  type EmployeeInterpretation,
  type EvaluationFactView,
  type ProjectContributionFact,
  type ResponsibilityWindowFact,
  type SourceCoverageNote,
} from "@evaluation/contracts";

export type EvaluationFactSourceBundle = Readonly<{
  responsibilityWindows?: readonly ResponsibilityWindowFact[];
  projectFacts?: readonly ProjectContributionFact[];
  confirmedEvidence?: readonly ConfirmedEvidenceFact[];
  checkInFacts?: readonly CheckInFact[];
  dynamicCriteriaVersions?: readonly CriterionVersionFact[];
  employeeInterpretations?: readonly EmployeeInterpretation[];
  sourceCoverageNotes?: readonly SourceCoverageNote[];
}>;

export type NormalizedEvaluationFacts = Omit<
  EvaluationFactView,
  "schemaVersion" | "cycle" | "subjectEmployeeId" | "generatedAt"
>;

export function normalizeEvaluationFactSources(
  cycle: EvaluationFactView["cycle"],
  bundles: readonly EvaluationFactSourceBundle[],
): NormalizedEvaluationFacts {
  const responsibilityWindows = uniqueFacts(
    bundles.flatMap(({ responsibilityWindows: facts = [] }) => facts).map(parseResponsibility),
  ).filter(
    ({ startedAt, endedAt }) =>
      Date.parse(startedAt) <= Date.parse(cycle.endsAt) &&
      (endedAt === null || Date.parse(endedAt) > Date.parse(cycle.startsAt)),
  );
  const parsedProjectFacts = uniqueFacts(
    bundles.flatMap(({ projectFacts: facts = [] }) => facts).map(parseProjectFact),
  ).filter(({ sourceOccurredAt }) => insideCycle(sourceOccurredAt, cycle));
  const projectFacts = parsedProjectFacts.map((fact) => ({
    ...fact,
    responsibilityWindowIds: uniqueStrings([
      ...fact.responsibilityWindowIds,
      ...responsibilityWindows
        .filter((window) => responsibilityApplies(window, fact))
        .map(({ sourceId }) => sourceId),
    ]),
  }));
  const confirmedEvidence = uniqueFacts(
    bundles.flatMap(({ confirmedEvidence: facts = [] }) => facts).map(parseEvidence),
  ).filter(({ sourceOccurredAt }) => insideCycle(sourceOccurredAt, cycle));
  const checkInFacts = uniqueFacts(
    bundles.flatMap(({ checkInFacts: facts = [] }) => facts).map(parseCheckIn),
  ).filter(({ sourceOccurredAt }) => insideCycle(sourceOccurredAt, cycle));
  const dynamicCriteriaVersions = uniqueFacts(
    bundles.flatMap(({ dynamicCriteriaVersions: facts = [] }) => facts).map(parseCriterionVersion),
  ).filter(
    ({ effectiveFrom, effectiveUntil }) =>
      Date.parse(effectiveFrom) <= Date.parse(cycle.endsAt) &&
      (effectiveUntil === null || Date.parse(effectiveUntil) > Date.parse(cycle.startsAt)),
  );
  const employeeInterpretations = uniqueBy(
    bundles
      .flatMap(({ employeeInterpretations: facts = [] }) => facts)
      .map((fact) => EmployeeInterpretationSchema.parse(fact)),
    ({ id }) => id,
  ).sort(
    (left, right) =>
      compareInstant(left.createdAt, right.createdAt) || left.id.localeCompare(right.id),
  );
  const sourceCoverageNotes = uniqueBy(
    bundles
      .flatMap(({ sourceCoverageNotes: facts = [] }) => facts)
      .map((fact) => SourceCoverageNoteSchema.parse(fact)),
    (note) =>
      [
        note.code,
        note.scope,
        note.projectId ?? "",
        note.workstreamId ?? "",
        note.messageKey,
        [...note.sourceFactIds].sort().join(","),
      ].join(":"),
  );

  return {
    responsibilityWindows,
    projectFacts,
    confirmedEvidence,
    checkInFacts,
    dynamicCriteriaVersions,
    employeeInterpretations,
    sourceCoverageNotes,
  };
}

function uniqueFacts<T extends Readonly<{ sourceId: string; sourceOccurredAt: string }>>(
  facts: readonly T[],
): T[] {
  return uniqueBy(facts, ({ sourceId }) => sourceId).sort(
    (left, right) =>
      compareInstant(left.sourceOccurredAt, right.sourceOccurredAt) ||
      left.sourceId.localeCompare(right.sourceId),
  );
}

function uniqueBy<T>(items: readonly T[], identity: (item: T) => string): T[] {
  const unique = new Map<string, T>();
  for (const item of items) {
    const key = identity(item);
    const previous = unique.get(key);
    if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(item)) {
      throw new Error(`Conflicting evaluation source identity: ${key}`);
    }
    unique.set(key, item);
  }
  return [...unique.values()];
}

function insideCycle(occurredAt: string, cycle: EvaluationFactView["cycle"]): boolean {
  const instant = Date.parse(occurredAt);
  return instant >= Date.parse(cycle.startsAt) && instant <= Date.parse(cycle.endsAt);
}

function compareInstant(left: string, right: string): number {
  return Date.parse(left) - Date.parse(right);
}

function responsibilityApplies(
  window: ResponsibilityWindowFact,
  fact: ProjectContributionFact,
): boolean {
  if (window.projectId !== fact.projectId) return false;
  if (window.workstreamId !== null && window.workstreamId !== fact.workstreamId) return false;
  const occurredAt = Date.parse(fact.sourceOccurredAt);
  return (
    Date.parse(window.startedAt) <= occurredAt &&
    (window.endedAt === null || occurredAt < Date.parse(window.endedAt))
  );
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

const parseResponsibility = (fact: ResponsibilityWindowFact): ResponsibilityWindowFact =>
  ResponsibilityWindowFactSchema.parse(fact);
const parseProjectFact = (fact: ProjectContributionFact): ProjectContributionFact =>
  ProjectContributionFactSchema.parse(fact);
const parseEvidence = (fact: ConfirmedEvidenceFact): ConfirmedEvidenceFact =>
  ConfirmedEvidenceFactSchema.parse(fact);
const parseCheckIn = (fact: CheckInFact): CheckInFact => CheckInFactSchema.parse(fact);
const parseCriterionVersion = (fact: CriterionVersionFact): CriterionVersionFact =>
  CriterionVersionFactSchema.parse(fact);
