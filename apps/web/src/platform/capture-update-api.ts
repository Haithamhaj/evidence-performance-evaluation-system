import { z } from "zod";

import { ClarificationStateSchema, StartTextUpdateInputSchema } from "./updates-evidence-contracts";

const InputSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    projectId: z.string().uuid(),
    workItemId: z.string().uuid().nullable(),
    rawText: z.string().trim().min(1).max(8_000),
  })
  .strict();

export type CapturePreparedUpdate = z.infer<typeof ClarificationStateSchema>;

export async function prepareCaptureUpdate(input: z.input<typeof InputSchema>) {
  const parsed = InputSchema.parse(input);
  const body = StartTextUpdateInputSchema.parse({
    idempotencyKey: parsed.idempotencyKey,
    projectId: parsed.projectId,
    workstreamId: null,
    workItemId: parsed.workItemId,
    rawText: parsed.rawText,
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
