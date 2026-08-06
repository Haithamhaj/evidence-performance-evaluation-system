import { AppError } from "@evaluation/contracts";

type ExperimentState = import("@evaluation/contracts").ExperimentState;

type MethodReadyInput = Readonly<{
  baseline: Readonly<{ description: string }>;
  measures: ReadonlyArray<Readonly<{ kind: string; interpretationRule: string }>>;
  testCases: readonly unknown[];
  controls: readonly unknown[];
  conditions: readonly string[];
  reproducibilityInstructions: string;
}>;

const transitions: Readonly<Record<ExperimentState, readonly ExperimentState[]>> = {
  DRAFT: ["READY", "ABANDONED", "SUPERSEDED"],
  READY: ["RUNNING", "RESULT_RECORDED", "ABANDONED", "SUPERSEDED"],
  RUNNING: ["RESULT_RECORDED", "ABANDONED", "SUPERSEDED"],
  RESULT_RECORDED: ["RUNNING", "CONCLUDED", "ABANDONED", "SUPERSEDED"],
  CONCLUDED: [],
  ABANDONED: [],
  SUPERSEDED: [],
};

export function assertMethodReady(method: MethodReadyInput): void {
  if (
    method.baseline.description.trim().length === 0 ||
    method.measures.length === 0 ||
    method.testCases.length === 0 ||
    method.conditions.length === 0 ||
    method.conditions.some((condition) => condition.trim().length === 0) ||
    method.reproducibilityInstructions.trim().length === 0 ||
    method.measures.some(
      (measure) =>
        (["NUMERIC", "QUALITATIVE"].includes(measure.kind) || measure.kind.length > 0) &&
        measure.interpretationRule.trim().length === 0,
    )
  ) {
    throw new AppError(
      "EXPERIMENT_METHOD_INCOMPLETE",
      "errors.research.experimentMethodIncomplete",
      409,
    );
  }
}

export function assertExperimentTransition(from: ExperimentState, to: ExperimentState): void {
  if (!transitions[from].includes(to)) {
    throw new AppError(
      "EXPERIMENT_TRANSITION_INVALID",
      "errors.research.experimentTransitionInvalid",
      409,
    );
  }
}

const secretName =
  /(?:^|[_\-.])(?:api[_-]?key|token|secret|password|credential|private[_-]?key)(?:$|[_\-.])/iu;

export function assertNoSecretConfiguration(
  entries: ReadonlyArray<Readonly<{ name: string; value: string }>>,
): void {
  if (entries.some(({ name }) => secretName.test(name.replace(/([a-z])([A-Z])/gu, "$1_$2")))) {
    throw new AppError(
      "EXPERIMENT_SECRET_CONFIGURATION",
      "errors.research.experimentSecretConfiguration",
      400,
    );
  }
}
