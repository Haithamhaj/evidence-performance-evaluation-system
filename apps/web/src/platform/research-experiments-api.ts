import { WebResearchSourceReviewSchema } from "./research-experiments-contracts";
import { z } from "zod";

export async function startResearchSourceReview(input: {
  readonly projectId: string;
  readonly url: string;
}): Promise<import("./research-experiments-contracts").WebResearchSourceReview> {
  const response = await fetch("/api/research/source-reviews", {
    body: JSON.stringify(input),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("RESEARCH_REVIEW_FAILED");
  return WebResearchSourceReviewSchema.parse(await response.json());
}

const ConfirmedReviewSchema = z
  .object({ state: z.literal("confirmed"), officialTaskCreated: z.literal(false) })
  .strict();

export async function confirmResearchProposals(input: {
  readonly reviewHandle: string;
  readonly expectedVersion: number;
  readonly proposalHandles: readonly string[];
  readonly reason: string;
}): Promise<void> {
  const response = await fetch("/api/research/source-reviews/confirm", {
    body: JSON.stringify(input),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("RESEARCH_CONFIRMATION_FAILED");
  ConfirmedReviewSchema.parse(await response.json());
}
