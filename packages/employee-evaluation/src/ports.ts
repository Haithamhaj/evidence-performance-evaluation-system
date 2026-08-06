export type EvaluationTransaction = import("@evaluation/database").DatabaseTransaction;

export type EvaluationRubricCriterion = Readonly<{
  id: string;
  title: string;
  sectionId: string;
  internalWeight?: number | undefined;
  anchors: ReadonlyArray<Readonly<{ rating: number; text: string }>>;
}>;

export type EvaluationRubricSnapshot = Readonly<{
  id: string;
  organizationId: string;
  version: string;
  status: "draft" | "active";
  protectedGlobalCriterionIds: ReadonlyArray<string>;
  locales: ReadonlyArray<
    Readonly<{
      locale: string;
      status: "draft" | "active";
      sourceHash: string;
      sections: ReadonlyArray<Readonly<{ id: string; title: string; weight: number }>>;
      criteria: ReadonlyArray<EvaluationRubricCriterion>;
    }>
  >;
}>;

export interface EvaluationRubricReader {
  readEvaluationRubric(
    transaction: EvaluationTransaction,
    rubricVersionId: string,
  ): Promise<EvaluationRubricSnapshot | null>;
}

export interface EvaluationOrganizationReader {
  departmentBelongsToOrganization(
    transaction: EvaluationTransaction,
    input: Readonly<{ organizationId: string; departmentId: string }>,
  ): Promise<boolean>;
}

export type CycleEligibilitySnapshot = Readonly<{
  id: string;
  version: number;
  managerId: string;
  visibilityMode: "identified" | "manager_blinded" | "anonymous_aggregated";
  effectiveFrom: string;
  effectiveTo: string;
  entries: ReadonlyArray<
    Readonly<{
      employeeId: string;
      state: "active" | "excluded" | "approved_leave" | "pending";
      sourceReason: string;
      effectiveFrom: string;
      effectiveTo: string;
    }>
  >;
}>;

export interface EligibilitySnapshotReader {
  readCycleEligibility(
    input: Readonly<{
      organizationId: string;
      departmentId: string;
      actorId: string;
      startsAt: string;
      endsAt: string;
      reason: string;
    }>,
    transaction: EvaluationTransaction,
  ): Promise<CycleEligibilitySnapshot>;
}
