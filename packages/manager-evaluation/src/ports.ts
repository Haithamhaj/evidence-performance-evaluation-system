export type ManagerEvaluationTransaction = import("@evaluation/database").DatabaseTransaction;

export type FrozenEmployeeEvaluationBoundary = Readonly<{
  cycleId: string;
  departmentId: string;
  startsAt: string;
  endsAt: string;
  rubricVersionId: string;
  managerId: string;
  entries: ReadonlyArray<
    Readonly<{
      employeeId: string;
      employeeDisplayName: string;
      state: "ELIGIBLE" | "EXCLUDED" | "APPROVED_LEAVE" | "PENDING_REVIEW";
      reason: string;
      effectiveAt: string;
    }>
  >;
}>;

/** Public E4 boundary. Manager evaluation never reads employee-evaluation tables itself. */
export interface FrozenEmployeeEvaluationBoundaryReader {
  read(
    transaction: ManagerEvaluationTransaction,
    employeeEvaluationCycleId: string,
  ): Promise<FrozenEmployeeEvaluationBoundary | null>;
}

export interface ManagerSummaryRouter {
  run<TInput, TOutput>(
    input: import("@evaluation/ai-routing").AiRunRequest<TInput, TOutput>,
    persistValidatedOutput: import("@evaluation/ai-routing").PersistValidatedOutput<
      TOutput,
      ManagerEvaluationTransaction
    >,
  ): Promise<import("@evaluation/ai-routing").ValidatedAiResult<TOutput>>;
}
