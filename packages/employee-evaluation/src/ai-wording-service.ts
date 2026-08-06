import {
  AppError,
  EvaluationAiWordingOutputSchema,
  EvaluationAiWordingRequestSchema,
  EvaluationFactViewSchema,
  type EvaluationFactView,
} from "@evaluation/contracts";
import type { ValidatedAiResult } from "@evaluation/ai-routing";

import {
  EvaluationJustificationOutputSchema,
  assertEvaluationJustificationSemantics,
  buildEvaluationJustificationRequest,
} from "./prompts.js";

export interface EvaluationWordingRouter {
  run<TInput, TOutput>(
    input: import("@evaluation/ai-routing").AiRunRequest<TInput, TOutput>,
    persistValidatedOutput: import("@evaluation/ai-routing").PersistValidatedOutput<TOutput>,
  ): Promise<ValidatedAiResult<TOutput>>;
}

export type EvaluationWordingContext = Readonly<{
  assignmentId: string;
  actorId: string;
  departmentId: string;
  systemId: string;
  criterion: Readonly<{
    id: string;
    locale: "en";
    anchors: ReadonlyArray<Readonly<{ rating: number; text: string }>>;
  }>;
  factView: Readonly<EvaluationFactView>;
}>;

export interface EvaluationWordingContextReader {
  read(
    input: Readonly<{
      assignmentId: string;
      actorId: string;
      criterionId: string;
      locale: "en";
    }>,
  ): Promise<EvaluationWordingContext>;
}

export class EvaluationWordingService {
  readonly #router: EvaluationWordingRouter;
  readonly #contextReader: EvaluationWordingContextReader;
  readonly #timeoutMs: number;

  constructor(
    dependencies: Readonly<{
      router: EvaluationWordingRouter;
      contextReader: EvaluationWordingContextReader;
      timeoutMs: number;
    }>,
  ) {
    this.#router = dependencies.router;
    this.#contextReader = dependencies.contextReader;
    this.#timeoutMs = dependencies.timeoutMs;
  }

  async draftJustification(input: unknown) {
    if (
      input === null ||
      typeof input !== "object" ||
      !("selectedRating" in input) ||
      input.selectedRating === null ||
      input.selectedRating === undefined
    ) {
      throw new AppError(
        "RATING_REQUIRED_BEFORE_AI",
        "errors.evaluation.ratingRequiredBeforeAi",
        409,
      );
    }
    const parsed = EvaluationAiWordingRequestSchema.parse(input);
    const context = await this.#contextReader.read({
      assignmentId: parsed.assignmentId,
      actorId: parsed.actorId,
      criterionId: parsed.criterionId,
      locale: parsed.locale,
    });
    assertContext(context, parsed);
    const anchor = context.criterion.anchors.find(
      (candidate) => candidate.rating === parsed.selectedRating,
    );
    if (anchor === undefined || anchor.text !== parsed.selectedAnchor) {
      throw new AppError("EVALUATION_ANCHOR_MISMATCH", "errors.evaluation.anchorMismatch", 409);
    }

    const view = EvaluationFactViewSchema.parse(context.factView);
    const facts = selectableFacts(view);
    const byId = new Map(facts.map((fact) => [fact.sourceId, fact]));
    if (
      new Set(parsed.sourceReferences).size !== parsed.sourceReferences.length ||
      parsed.sourceReferences.some((sourceId) => !byId.has(sourceId))
    ) {
      throw new AppError(
        "EVALUATION_FACT_SOURCE_NOT_AUTHORIZED",
        "errors.evaluation.factSourceNotAuthorized",
        403,
      );
    }
    const chosenFacts = parsed.sourceReferences.map((sourceId) => byId.get(sourceId)!);
    const governed = buildEvaluationJustificationRequest({
      selectedRating: parsed.selectedRating,
      selectedAnchor: anchor.text,
      chosenFacts,
      locale: parsed.locale,
      userDraft: parsed.userDraft,
    });
    const assignmentReference = `evaluation-assignment:${parsed.assignmentId}`;
    const sourceReferences =
      parsed.sourceReferences.length === 0
        ? [assignmentReference]
        : parsed.sourceReferences.map((sourceId) => `evaluation-fact:${sourceId}`);
    const result = await this.#router.run(
      {
        routeKey: governed.routeKey,
        departmentId: context.departmentId,
        systemId: context.systemId,
        input: governed.input,
        inputReference: assignmentReference,
        inputSchemaVersion: governed.inputSchemaVersion,
        outputSchemaVersion: governed.outputSchemaVersion,
        promptTemplateVersion: governed.promptTemplateVersion,
        outputSchema: EvaluationJustificationOutputSchema,
        sourceReferences,
        classification: "confidential",
        timeoutMs: this.#timeoutMs,
        requiresHumanApproval: true,
        correlationId: crypto.randomUUID(),
      },
      async () => ({ outputReference: assignmentReference }),
    );
    const output = EvaluationAiWordingOutputSchema.parse(result.output);
    assertEvaluationJustificationSemantics(output, parsed.sourceReferences);
    return output;
  }
}

function assertContext(
  context: EvaluationWordingContext,
  input: Readonly<{
    assignmentId: string;
    actorId: string;
    criterionId: string;
    locale: "en";
  }>,
): void {
  if (
    context.assignmentId !== input.assignmentId ||
    context.actorId !== input.actorId ||
    context.criterion.id !== input.criterionId ||
    context.criterion.locale !== input.locale
  ) {
    throw new AppError("AUTHZ_SCOPE", "errors.authorization.denied", 403);
  }
}

function selectableFacts(
  view: Readonly<EvaluationFactView>,
): import("./prompts.js").EvaluationChosenFact[] {
  return [
    ...view.responsibilityWindows,
    ...view.projectFacts,
    ...view.confirmedEvidence,
    ...view.checkInFacts,
    ...view.dynamicCriteriaVersions,
    ...view.researchFacts,
  ];
}
