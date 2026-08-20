import {
  ConfirmWebResearchDecisionInputSchema,
  CreateWebResearchRecordInputSchema,
  CreateWebExperimentInputSchema,
  WebExperimentRecordListSchema,
  WebExperimentRecordSchema,
  WebResearchRecordListSchema,
  WebResearchRecordSchema,
  WebResearchSourceReviewSchema,
} from "./research-experiments-contracts";
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
const ConfirmedResearchDecisionSchema = z
  .object({
    state: z.literal("confirmed"),
    decision: ConfirmWebResearchDecisionInputSchema.shape.decision,
    appliedLearning: z.literal(true),
  })
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

export async function createResearchRecord(
  input: z.input<typeof CreateWebResearchRecordInputSchema>,
): Promise<import("./research-experiments-contracts").WebResearchRecord> {
  const body = CreateWebResearchRecordInputSchema.parse(input);
  const response = await fetch("/api/research/records", {
    body: JSON.stringify(body),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("RESEARCH_CREATE_FAILED");
  return WebResearchRecordSchema.parse(await response.json());
}

export async function listResearchRecords(
  projectId: string,
): Promise<readonly import("./research-experiments-contracts").WebResearchRecord[]> {
  const parsedProjectId = z.string().uuid().parse(projectId);
  const response = await fetch(
    `/api/research/records?projectId=${encodeURIComponent(parsedProjectId)}`,
    { credentials: "same-origin" },
  );
  if (!response.ok) throw new Error("RESEARCH_LIST_FAILED");
  return WebResearchRecordListSchema.parse(await response.json());
}

export async function listResearchExperiments(
  researchHandle: string,
): Promise<readonly import("./research-experiments-contracts").WebExperimentRecord[]> {
  const handle = z.string().min(32).max(4_096).parse(researchHandle);
  const response = await fetch(`/api/research/records/${encodeURIComponent(handle)}/experiments`, {
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("EXPERIMENT_LIST_FAILED");
  return WebExperimentRecordListSchema.parse(await response.json());
}

export async function createResearchExperiment(
  researchHandle: string,
  input: z.input<typeof CreateWebExperimentInputSchema>,
): Promise<import("./research-experiments-contracts").WebExperimentRecord> {
  const handle = z.string().min(32).max(4_096).parse(researchHandle);
  const body = CreateWebExperimentInputSchema.parse(input);
  const response = await fetch(`/api/research/records/${encodeURIComponent(handle)}/experiments`, {
    body: JSON.stringify(body),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("EXPERIMENT_CREATE_FAILED");
  return WebExperimentRecordSchema.parse(await response.json());
}

export async function confirmResearchDecision(
  researchHandle: string,
  input: z.input<typeof ConfirmWebResearchDecisionInputSchema>,
): Promise<void> {
  const handle = z.string().min(32).max(4_096).parse(researchHandle);
  const body = ConfirmWebResearchDecisionInputSchema.parse(input);
  const response = await fetch(`/api/research/records/${encodeURIComponent(handle)}/decision`, {
    body: JSON.stringify(body),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("RESEARCH_DECISION_FAILED");
  ConfirmedResearchDecisionSchema.parse(await response.json());
}
