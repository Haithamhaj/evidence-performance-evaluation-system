import { AppError, EvaluationFactViewSchema } from "@evaluation/contracts";

type Rating = 1 | 2 | 3 | 4 | 5;

type SubmittedEntry = Readonly<{
  criterionId: string;
  rating: Rating;
  justification: string;
  sourceReferences: ReadonlyArray<string>;
  directObservationBasis: string | null;
}>;

type ImmutableSubmission = Readonly<{
  assignmentId: string;
  kind: "SELF" | "MANAGER_INITIAL";
  entries: ReadonlyArray<SubmittedEntry>;
}>;

export type EvaluationComparisonResult = Readonly<{
  schemaVersion: 1;
  assignmentId: string;
  entries: ReadonlyArray<
    Readonly<{
      criterionId: string;
      selfRating: Rating;
      managerRating: Rating;
      gap: number;
      effectiveWeight: number;
      highWeightGap: boolean;
      selfSourceReferences: ReadonlyArray<string>;
      managerSourceReferences: ReadonlyArray<string>;
      sourceDifference: Readonly<{
        selfOnly: ReadonlyArray<string>;
        managerOnly: ReadonlyArray<string>;
      }>;
      missingRationale: Readonly<{ self: boolean; manager: boolean }>;
      responsibilityDurationInterpretation: ReadonlyArray<
        Readonly<{
          sourceId: string;
          responsibilityType: "original_owner" | "acting_owner" | "permanent_owner" | "contributor";
          startedAt: string;
          endedAt: string | null;
        }>
      >;
      disputedAttributionSourceIds: ReadonlyArray<string>;
      discussionRequired: boolean;
    }>
  >;
  discussionEntries: ReadonlyArray<
    Readonly<{
      id: string;
      body: string;
      sourceReferences: ReadonlyArray<string>;
      createdAt: string;
    }>
  >;
  generatedAt: string;
}>;

export class ComparisonService {
  readonly #clock: () => Date;

  constructor(clock: () => Date = () => new Date()) {
    this.#clock = clock;
  }

  read(
    input: Readonly<{
      assignmentId: string;
      selfSubmission: ImmutableSubmission;
      managerSubmission: ImmutableSubmission;
      templateItems: ReadonlyArray<
        Readonly<{
          criterionId: string;
          kind: "FIXED_CRITERION" | "PROJECT_CONTRIBUTION";
          sectionWeight: number;
          criterionWeight: number | null;
        }>
      >;
      discussionEntries: ReadonlyArray<
        Readonly<{
          id: string;
          body: string;
          sourceReferences: ReadonlyArray<string>;
          createdAt: string;
        }>
      >;
      factView: import("@evaluation/contracts").EvaluationFactView;
      factScope: Readonly<{
        cycleId: string;
        subjectEmployeeId: string;
        rubricVersionId: string;
        startsAt: string;
        endsAt: string;
      }>;
    }>,
  ): EvaluationComparisonResult {
    if (
      input.selfSubmission.assignmentId !== input.assignmentId ||
      input.managerSubmission.assignmentId !== input.assignmentId ||
      input.selfSubmission.kind !== "SELF" ||
      input.managerSubmission.kind !== "MANAGER_INITIAL"
    ) {
      throw comparisonError("EVALUATION_COMPARISON_SCOPE_INVALID");
    }

    const selfEntries = uniqueEntries(input.selfSubmission.entries);
    const managerEntries = uniqueEntries(input.managerSubmission.entries);
    const expectedIds = input.templateItems.map(({ criterionId }) => criterionId);
    if (
      !sameIds(expectedIds, [...selfEntries.keys()]) ||
      !sameIds(expectedIds, [...managerEntries.keys()])
    ) {
      throw comparisonError("EVALUATION_COMPARISON_CRITERIA_INVALID");
    }

    const factView = EvaluationFactViewSchema.parse(input.factView);
    if (
      factView.cycle.id !== input.factScope.cycleId ||
      factView.subjectEmployeeId !== input.factScope.subjectEmployeeId ||
      factView.cycle.rubricVersionId !== input.factScope.rubricVersionId ||
      Date.parse(factView.cycle.startsAt) !== Date.parse(input.factScope.startsAt) ||
      Date.parse(factView.cycle.endsAt) !== Date.parse(input.factScope.endsAt)
    ) {
      throw comparisonError("EVALUATION_COMPARISON_FACT_SCOPE_INVALID");
    }
    const factById = new Map(
      [...factView.projectFacts, ...factView.confirmedEvidence, ...factView.researchFacts].map(
        (fact) => [fact.sourceId, fact],
      ),
    );
    const responsibilityById = new Map(
      factView.responsibilityWindows.map((window) => [window.sourceId, window]),
    );
    const prepared = input.templateItems.map((item) => {
      const self = selfEntries.get(item.criterionId)!;
      const manager = managerEntries.get(item.criterionId)!;
      const gap = self.rating - manager.rating;
      const selfOnly = self.sourceReferences.filter(
        (sourceId) => !manager.sourceReferences.includes(sourceId),
      );
      const managerOnly = manager.sourceReferences.filter(
        (sourceId) => !self.sourceReferences.includes(sourceId),
      );
      const selectedSourceIds = unique([...self.sourceReferences, ...manager.sourceReferences]);
      const responsibilityIds = new Set<string>();
      for (const sourceId of selectedSourceIds) {
        if (responsibilityById.has(sourceId)) responsibilityIds.add(sourceId);
        const fact = factById.get(sourceId);
        if (fact !== undefined && "responsibilityWindowIds" in fact) {
          for (const windowId of fact.responsibilityWindowIds) responsibilityIds.add(windowId);
        }
      }
      const responsibilityDurationInterpretation = [...responsibilityIds]
        .map((sourceId) => responsibilityById.get(sourceId))
        .filter((window): window is NonNullable<typeof window> => window !== undefined)
        .map(({ sourceId, responsibilityType, startedAt, endedAt }) => ({
          sourceId,
          responsibilityType,
          startedAt,
          endedAt,
        }));
      const disputedAttributionSourceIds = selectedSourceIds.filter((sourceId) => {
        const fact = factById.get(sourceId);
        return (
          fact !== undefined && "attributionState" in fact && fact.attributionState === "disputed"
        );
      });
      const missingRationale = {
        self: self.justification.trim().length === 0,
        manager: manager.justification.trim().length === 0,
      };
      const effectiveWeight =
        item.kind === "PROJECT_CONTRIBUTION"
          ? item.sectionWeight
          : (item.sectionWeight * (item.criterionWeight ?? 0)) / 100;
      return {
        criterionId: item.criterionId,
        selfRating: self.rating,
        managerRating: manager.rating,
        gap,
        effectiveWeight,
        selfSourceReferences: unique(self.sourceReferences),
        managerSourceReferences: unique(manager.sourceReferences),
        sourceDifference: { selfOnly, managerOnly },
        missingRationale,
        responsibilityDurationInterpretation,
        disputedAttributionSourceIds,
        discussionRequired:
          gap !== 0 ||
          selfOnly.length > 0 ||
          managerOnly.length > 0 ||
          missingRationale.self ||
          missingRationale.manager ||
          disputedAttributionSourceIds.length > 0,
      };
    });
    const highestDifferingWeight = Math.max(
      ...prepared.filter(({ gap }) => gap !== 0).map(({ effectiveWeight }) => effectiveWeight),
      -1,
    );
    const generatedAt = this.#clock();
    if (!Number.isFinite(generatedAt.getTime())) {
      throw comparisonError("EVALUATION_COMPARISON_TIME_INVALID");
    }
    return {
      schemaVersion: 1,
      assignmentId: input.assignmentId,
      entries: prepared.map((entry) => ({
        ...entry,
        highWeightGap: entry.gap !== 0 && entry.effectiveWeight === highestDifferingWeight,
      })),
      discussionEntries: input.discussionEntries.map((entry) => ({
        ...entry,
        sourceReferences: unique(entry.sourceReferences),
      })),
      generatedAt: generatedAt.toISOString(),
    };
  }
}

function uniqueEntries(entries: ReadonlyArray<SubmittedEntry>): Map<string, SubmittedEntry> {
  const byId = new Map(entries.map((entry) => [entry.criterionId, entry]));
  if (byId.size !== entries.length) {
    throw comparisonError("EVALUATION_COMPARISON_CRITERIA_INVALID");
  }
  return byId;
}

function sameIds(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
  return [...left].sort().join("\0") === [...right].sort().join("\0");
}

function unique(values: ReadonlyArray<string>): string[] {
  return [...new Set(values)];
}

function comparisonError(code: string): AppError {
  return new AppError(code, "errors.evaluation.comparisonInvalid", 409);
}
