import type { StructuredUpdateDraft } from "./types";

type StructureContext = {
  readonly workItemId: string | null;
  readonly criterionIds: readonly string[];
};

const resultPattern = /(?:reduced|improved|completed|validated|result|خفض|أكمل|تحقق|نتيجة)/iu;

export function structureTextUpdate(
  rawText: string,
  context: StructureContext,
): StructuredUpdateDraft {
  const hasResult = resultPattern.test(rawText);
  const resultMatch = rawText.match(
    /(?:reduced|improved|خفض)[^.،]*?(?:\d+%)[^.،]*|(?:completed|validated|أكمل|تحقق)[^.،]*/iu,
  );
  const nextStepMatch = rawText.match(/(?:next(?: step)? is|next i will|الخطوة التالية)[^.،]*/iu);
  const blockerMatch = rawText.match(/(?:blocker|blocked|تأخير|عائق)[^.،]*/iu);

  return {
    originalInput: rawText,
    activity: rawText.split(/[.،]/u)[0]?.trim() ?? rawText,
    result: hasResult ? (resultMatch?.[0]?.trim() ?? "Result recorded in the update.") : "",
    personalContribution: "Prepared the work, reviewed the outcome, and documented context.",
    teamContribution: "Team input is retained separately and is not implied.",
    participants: [],
    impact: hasResult ? "The result informs the next project decision." : "",
    blocker: blockerMatch?.[0]?.trim() ?? "",
    decision: "",
    learning: "",
    nextStep: nextStepMatch?.[0]?.trim() ?? "",
    relatedWorkItemId: context.workItemId,
    relatedCriteria: context.criterionIds,
    suggestedEvidenceIds: [],
    missingContext: hasResult ? [] : ["result"],
    clarificationQuestion: hasResult ? null : "What result or decision came from this activity?",
  };
}

export function structureTranscript(
  transcript: string,
  context: StructureContext,
): StructuredUpdateDraft {
  const draft = structureTextUpdate(transcript, context);
  const blockerMatch = transcript.match(/(?:واجهنا|تأخير|عائق)[^.،]*/u);
  const nextStepMatch = transcript.match(/Next step is[^.،]*/iu);

  return {
    ...draft,
    blocker: blockerMatch?.[0]?.trim() ?? draft.blocker,
    nextStep: nextStepMatch?.[0]?.trim() ?? draft.nextStep,
  };
}
