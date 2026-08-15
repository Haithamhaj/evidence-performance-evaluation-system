import { z } from "zod";

import type { SelectedReviewAction } from "../features/review-confirmation/review-confirmation-model";

const UuidSchema = z.string().uuid();
const AcceptedUpdateSchema = z.object({ id: UuidSchema }).passthrough();
const AcceptedEvidenceSchema = z.object({ id: UuidSchema }).passthrough();
const RevisedUpdateSchema = z.object({ revision: z.number().int().positive() }).passthrough();
const RevisedEvidenceSchema = z.object({ revision: z.number().int().positive() }).passthrough();
const RejectedEvidenceSchema = z
  .object({ revision: z.number().int().positive(), state: z.literal("rejected") })
  .passthrough();

export class ReviewCommandError extends Error {
  constructor(readonly status: number) {
    super(`REVIEW_COMMAND_${status}`);
  }
}

export type ReviewOutcome = Readonly<{
  kind: SelectedReviewAction["kind"] | "progress_proposal";
  state: "confirmed" | "forbidden" | "retryable_error" | "stale";
  receiptId: string | null;
  safeMessage: string;
}>;

export async function rejectEvidenceDraft(input: { id: string; expectedRevision: number }) {
  const id = UuidSchema.parse(input.id);
  const response = await fetch(`/api/daily-work/evidence/${id}/reject`, {
    body: JSON.stringify({
      expectedRevision: z.number().int().positive().parse(input.expectedRevision),
      reason: "Employee dismissed the Evidence suggestion during review.",
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new ReviewCommandError(response.status);
  return RejectedEvidenceSchema.parse(await response.json());
}

export async function executeSelectedActions(actions: readonly SelectedReviewAction[]): Promise<
  Readonly<{
    schemaVersion: "review-confirmation-result.v1";
    completedAt: string;
    outcomes: readonly ReviewOutcome[];
  }>
> {
  const outcomes: ReviewOutcome[] = [];
  for (const action of actions) outcomes.push(await execute(action));
  return {
    schemaVersion: "review-confirmation-result.v1",
    completedAt: new Date().toISOString(),
    outcomes,
  };
}

async function execute(action: SelectedReviewAction): Promise<ReviewOutcome> {
  const revisionResponse = await fetch(
    `/api/daily-work/${action.kind === "update" ? "updates" : "evidence"}/${action.id}/revisions`,
    {
      body: JSON.stringify(
        action.kind === "update"
          ? {
              expectedDraftRevision: action.expectedVersion,
              summary: action.summary,
              result: action.result,
              blocker: null,
              nextAction: action.nextAction,
              contributionContext: "Employee reviewed and confirmed this Update.",
              evidenceClaimDrafts: [],
              documentationNeeds: [],
              relatedProgressComponentIds: action.relatedProgressComponentIds,
            }
          : {
              expectedRevision: action.expectedVersion,
              supportedClaim: action.supportedClaim,
              contributionContext: action.contributionContext,
            },
      ),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
  if (!revisionResponse.ok) return failed(action.kind, revisionResponse.status);
  const revision = (action.kind === "update" ? RevisedUpdateSchema : RevisedEvidenceSchema).parse(
    await revisionResponse.json(),
  ).revision;
  const response = await fetch(
    `/api/daily-work/${action.kind === "update" ? "updates" : "evidence"}/${action.id}/confirm`,
    {
      body: JSON.stringify(
        action.kind === "update"
          ? {
              expectedDraftRevision: revision,
              reason: "Employee confirmed the selected review action.",
            }
          : {
              expectedRevision: revision,
              reason: "Employee confirmed the selected review action.",
            },
      ),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
  if (!response.ok) {
    return failed(action.kind, response.status);
  }
  const parsed = (action.kind === "update" ? AcceptedUpdateSchema : AcceptedEvidenceSchema).parse(
    await response.json(),
  );
  return {
    kind: action.kind,
    state: "confirmed",
    receiptId: parsed.id,
    safeMessage: `${label(action.kind)} confirmed.`,
  };
}

function failed(kind: SelectedReviewAction["kind"], status: number): ReviewOutcome {
  const state = status === 409 ? "stale" : status === 403 ? "forbidden" : "retryable_error";
  return { kind, state, receiptId: null, safeMessage: safeMessage(kind, state) };
}

function label(kind: ReviewOutcome["kind"]): string {
  return kind === "update" ? "Update" : kind === "evidence" ? "Evidence" : "Progress proposal";
}

function safeMessage(kind: ReviewOutcome["kind"], state: ReviewOutcome["state"]): string {
  if (state === "stale")
    return `${label(kind)} changed elsewhere. Refresh and review again; your edits remain available.`;
  if (state === "forbidden") return `${label(kind)} was not confirmed because access changed.`;
  return `${label(kind)} was not confirmed. Your edits remain available to retry.`;
}
