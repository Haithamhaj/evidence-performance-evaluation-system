import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  WebManagerCriterionResponsesSchema,
  WebSubmitManagerEvaluationReceiptSchema,
} from "../../../../platform/manager-feedback-contracts";
import { fetchProtectedUpstream, safeWorkspaceError } from "../../../../platform/workspace-api";

type Context = Readonly<{ params: Promise<{ path: string[] }> }>;

const UuidSchema = z.string().uuid();
const SubmitSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    identifiedNoticeConfirmed: z.literal(true),
    responses: WebManagerCriterionResponsesSchema,
  })
  .strict();

export async function POST(request: Request, context: Context) {
  const path = (await context.params).path;
  if (
    path.length !== 3 ||
    path[0] !== "cycles" ||
    path[2] !== "submit" ||
    !UuidSchema.safeParse(path[1]).success
  ) {
    return NextResponse.json({ messageKey: "errors.notFound" }, { status: 404 });
  }
  let input: z.infer<typeof SubmitSchema>;
  try {
    input = SubmitSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ messageKey: "errors.validation" }, { status: 400 });
  }
  try {
    const result = await fetchProtectedUpstream({
      method: "POST",
      path: "/api/v1/manager-evaluation/submissions",
      body: {
        schemaVersion: 1,
        cycleId: path[1]!,
        expectedVersion: input.expectedVersion,
        idempotencyKey: randomUUID(),
        identifiedNoticeConfirmed: true,
        confirmedAt: new Date().toISOString(),
        responses: input.responses,
      },
      schema: WebSubmitManagerEvaluationReceiptSchema,
    });
    return NextResponse.json({ status: "submitted", submittedAt: result.submittedAt });
  } catch (error) {
    const safe = safeWorkspaceError(error);
    return NextResponse.json(
      { messageKey: safe.messageKey, correlationId: safe.correlationId },
      { status: safe.status },
    );
  }
}

export const GET = () => NextResponse.json({ messageKey: "errors.notFound" }, { status: 404 });
