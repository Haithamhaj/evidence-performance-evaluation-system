import { z } from "zod";

import {
  ClarificationStateSchema,
  CreateManualEvidenceInputSchema,
  StartTextUpdateInputSchema,
  UpdateSourceInputSchema,
} from "./updates-evidence-contracts";

const InputSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    projectId: z.string().uuid(),
    workItemId: z.string().uuid().nullable(),
    rawText: z.string().trim().max(8_000),
    sources: z.array(UpdateSourceInputSchema).max(20).optional(),
  })
  .strict()
  .refine((value) => value.rawText.length > 0 || (value.sources?.length ?? 0) > 0);

export type CapturePreparedUpdate = z.infer<typeof ClarificationStateSchema>;

const PreparedEvidenceSchema = z
  .object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    supportedClaim: z.string().trim().min(1).max(2_000),
    contributionContext: z.string().trim().min(1).max(2_000),
  })
  .passthrough();

export async function prepareCaptureUpdate(input: z.input<typeof InputSchema>) {
  const parsed = InputSchema.parse(input);
  const body = StartTextUpdateInputSchema.parse({
    idempotencyKey: parsed.idempotencyKey,
    projectId: parsed.projectId,
    workstreamId: null,
    workItemId: parsed.workItemId,
    rawText: parsed.rawText,
    sources: parsed.sources,
    executionMode: "ai_assisted",
  });
  const response = await fetch("/api/daily-work/updates/text", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("CAPTURE_UPDATE_PREPARATION_FAILED");
  return ClarificationStateSchema.parse(await response.json());
}

export async function answerCaptureUpdate(input: {
  answer: string;
  sessionId: string;
  sessionVersion: number;
  turnId: string;
}) {
  const body = {
    answer: z.string().trim().min(1).max(20_000).parse(input.answer),
    expectedSessionVersion: z.number().int().positive().parse(input.sessionVersion),
    turnId: z.string().uuid().parse(input.turnId),
  };
  const response = await fetch(
    `/api/daily-work/updates/${z.string().uuid().parse(input.sessionId)}/answers`,
    {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
  if (!response.ok) throw new Error("CAPTURE_UPDATE_ANSWER_FAILED");
  return ClarificationStateSchema.parse(await response.json());
}

export async function prepareCaptureEvidence(input: {
  idempotencyKey: string;
  projectId: string;
  workItemId: string | null;
  updateSourceId: string;
  source: z.input<typeof CreateManualEvidenceInputSchema>["source"];
  supportedClaim: string;
  contributionContext: string;
}) {
  const body = CreateManualEvidenceInputSchema.parse({
    idempotencyKey: z.string().uuid().parse(input.idempotencyKey),
    projectId: z.string().uuid().parse(input.projectId),
    workstreamId: null,
    workItemId: z.string().uuid().nullable().parse(input.workItemId),
    capturedFromWorkItem: input.workItemId !== null,
    updateSourceId: z.string().uuid().parse(input.updateSourceId),
    source: input.source,
    supportedClaim: z.string().trim().min(1).max(2_000).parse(input.supportedClaim),
    relatedKpiComponentId: null,
    relatedCriterionId: null,
    contributionContext: z.string().trim().min(1).max(2_000).parse(input.contributionContext),
    executionMode: "ai_assisted" as const,
  });
  const response = await fetch("/api/daily-work/evidence", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("CAPTURE_EVIDENCE_PREPARATION_FAILED");
  return PreparedEvidenceSchema.parse(await response.json());
}
