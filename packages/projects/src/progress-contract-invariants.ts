import { AppError, ProgressContractDraftSchema } from "@evaluation/contracts";

export function validateProgressContractDraft(
  input: unknown,
): import("@evaluation/contracts").ProgressContractDraft {
  const parsed = ProgressContractDraftSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const invalidWeights = parsed.error.issues.some(
    ({ path, message }) => path[0] === "components" && /weight|total exactly 100/iu.test(message),
  );
  throw new AppError(
    invalidWeights ? "PROGRESS_CONTRACT_WEIGHTS_INVALID" : "PROGRESS_CONTRACT_INPUT_INVALID",
    invalidWeights
      ? "errors.progressContract.weightsInvalid"
      : "errors.progressContract.inputInvalid",
    400,
  );
}

export function calculateComponentPercent(
  component: import("@evaluation/contracts").ProgressContractComponent,
  measuredValue: number,
): number {
  if (
    component.kind !== "kpi" ||
    component.baseline === null ||
    component.target === null ||
    component.direction === null
  ) {
    throw new AppError("PROGRESS_SOURCE_INVALID", "errors.progressContract.sourceInvalid", 400);
  }
  if (component.direction === "maintain") {
    return measuredValue === component.target ? 100 : 0;
  }
  const span =
    component.direction === "increase"
      ? component.target - component.baseline
      : component.baseline - component.target;
  if (span <= 0) {
    throw new AppError(
      "PROGRESS_CONTRACT_RULE_INVALID",
      "errors.progressContract.ruleInvalid",
      400,
    );
  }
  const movement =
    component.direction === "increase"
      ? measuredValue - component.baseline
      : component.baseline - measuredValue;
  return Math.min(100, Math.max(0, (movement / span) * 100));
}
