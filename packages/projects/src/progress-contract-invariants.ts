import { AppError, ProgressContractDraftSchema } from "@evaluation/contracts";

export function validateProgressContractDraft(
  input: unknown,
): import("@evaluation/contracts").ProgressContractDraft {
  const parsed = ProgressContractDraftSchema.safeParse(input);
  if (parsed.success) {
    assertAllowedProgressMeasures(parsed.data.components);
    return parsed.data;
  }
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

export function assertAllowedProgressMeasures(
  components: readonly Readonly<{
    name: string;
    description: string;
    unit: string | null;
    acceptanceConditions: readonly string[];
    requiredEvidence: readonly string[];
  }>[],
): void {
  if (components.some(isProhibitedRawActivityMeasure)) {
    throw new AppError(
      "PROGRESS_CONTRACT_PROHIBITED_MEASURE",
      "errors.progressContract.prohibitedMeasure",
      400,
    );
  }
}

function isProhibitedRawActivityMeasure(
  component: Readonly<{
    name: string;
    description: string;
    unit: string | null;
    acceptanceConditions: readonly string[];
    requiredEvidence: readonly string[];
  }>,
): boolean {
  const unit = component.unit?.trim().toLocaleLowerCase("en") ?? "";
  if (
    /^(?:commits?|pull requests?|prs?|tasks?|work items?|files?|lines?|loc)$/u.test(unit) ||
    /^updates?\s+per\s+(?:day|week|month)$/u.test(unit)
  ) {
    return true;
  }
  const text = [
    component.name,
    component.description,
    component.unit ?? "",
    ...component.acceptanceConditions,
    ...component.requiredEvidence,
  ]
    .join(" ")
    .toLocaleLowerCase("en");
  return [
    /\bcommits?\s+(?:count|number|volume|frequency)\b|\b(?:count|number|volume|frequency)\s+of\s+commits?\b/u,
    /\b(?:pull requests?|prs?)\s+(?:count|number|volume|frequency)\b|\b(?:count|number|volume|frequency)\s+of\s+(?:pull requests?|prs?)\b/u,
    /\b(?:completed\s+)?(?:tasks?|work items?)\s+(?:count|number|volume|completion(?:\s+percentage)?)\b|\b(?:count|number|volume|percentage)\s+of\s+(?:completed\s+)?(?:tasks?|work items?)\b/u,
    /\bupdates?\b\s*(?:count|number|volume|frequency|per\s+(?:day|week|month))|\b(?:count|number|volume|frequency)\s+of\s+updates?\b/u,
    /\bgithub\s+activit(?:y|ies)\b/u,
    /\bfiles?\b\s*(?:changed|count|number|volume)|\b(?:count|number|volume)\s+of\s+files?\b/u,
    /\blines?\b\s*(?:changed|of\s+code|count|number|volume)|\b(?:count|number|volume)\s+of\s+lines?\b|\bloc\b/u,
    /\bevidence\b\s*(?:count|number|volume)|\b(?:count|number|volume)\s+of\s+evidence\b/u,
    /(?:عدد|حجم|تكرار)\s+(?:الكوميتات|الالتزامات|طلبات\s+السحب|المهام|عناصر\s+العمل|التحديثات|الملفات|الأدلة)/u,
    /(?:الأسطر|سطور\s+الكود)\s+(?:المتغيرة|المعدلة)|نشاط\s+github/u,
  ].some((pattern) => pattern.test(text));
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
