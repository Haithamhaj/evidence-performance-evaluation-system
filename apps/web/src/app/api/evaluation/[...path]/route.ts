import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchProtectedUpstream, safeWorkspaceError } from "../../../../platform/workspace-api";

type Context = Readonly<{ params: Promise<{ path: string[] }> }>;

const UuidSchema = z.string().uuid();
const RatingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
const EntrySchema = z
  .object({
    criterionId: UuidSchema,
    rating: RatingSchema,
    justification: z.string().trim().min(1).max(8_000),
    sourceReferences: z.array(UuidSchema).max(100),
    directObservationBasis: z.string().trim().min(1).max(4_000).nullable(),
  })
  .strict();
const SaveDraftSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    entries: z.array(EntrySchema).min(1).max(100),
  })
  .strict()
  .superRefine((input, context) => {
    const ids = input.entries.map(({ criterionId }) => criterionId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", path: ["entries"], message: "Duplicate criterion" });
    }
  });
const UpstreamDraftSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: UuidSchema,
    assignmentId: UuidSchema,
    kind: z.enum(["SELF", "MANAGER_INITIAL"]),
    version: z.number().int().positive(),
    entries: z.array(EntrySchema).max(100),
    updatedAt: z.iso.datetime({ offset: true }),
    submittedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict();
const SubmitSchema = z
  .object({ expectedVersion: z.number().int().positive(), reviewed: z.literal(true) })
  .strict();
const WordingDraftInputSchema = z
  .object({
    criterionId: UuidSchema,
    selectedRating: RatingSchema,
    selectedAnchor: z.string().trim().min(1).max(8_000),
    sourceReferences: z.array(UuidSchema).max(100),
    userDraft: z.string().trim().max(8_000),
  })
  .strict();
const WordingDraftOutputSchema = z
  .object({
    schemaVersion: z.literal("evaluation-justification.v1"),
    draft: z.string().trim().min(1).max(8_000),
    sourceReferences: z.array(UuidSchema).max(100),
    limitations: z.array(z.string().trim().min(1).max(2_000)).max(20),
  })
  .strict();
const SubmissionReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: UuidSchema,
    assignmentId: UuidSchema,
    kind: z.enum(["SELF", "MANAGER_INITIAL"]),
    assessmentId: UuidSchema,
    revisionId: UuidSchema,
    cycleSnapshotId: UuidSchema,
    submittedById: UuidSchema,
    selfProjectionAccessedBeforeSubmit: z.literal(false),
    confirmedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export async function POST(request: Request, context: Context) {
  const path = (await context.params).path;
  if (path.length !== 3 || path[0] !== "assignments" || !UuidSchema.safeParse(path[1]).success) {
    return notFound();
  }
  if (path[2] === "wording-draft") return draftWording(request, path[1]!);
  if (path[2] === "self-submit") return submitAssessment(request, path[1]!, "SELF");
  if (path[2] === "manager-submit") return submitAssessment(request, path[1]!, "MANAGER_INITIAL");
  const kind =
    path[2] === "self-draft" ? "SELF" : path[2] === "manager-draft" ? "MANAGER_INITIAL" : null;
  if (kind === null) return notFound();
  let input: z.infer<typeof SaveDraftSchema>;
  try {
    input = SaveDraftSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ messageKey: "errors.validation" }, { status: 400 });
  }
  try {
    const result = await fetchProtectedUpstream({
      method: "POST",
      path: `/api/v1/employee-evaluation/assignments/${path[1]}/drafts`,
      body: {
        schemaVersion: 1,
        kind,
        expectedVersion: input.expectedVersion,
        idempotencyKey: randomUUID(),
        entries: input.entries,
      },
      schema: UpstreamDraftSchema,
    });
    return NextResponse.json({
      status: "saved",
      version: result.version,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { messageKey: "errors.internal", correlationId: randomUUID() },
        { status: 500 },
      );
    }
    const safe = safeWorkspaceError(error);
    return NextResponse.json(
      { messageKey: safe.messageKey, correlationId: safe.correlationId },
      { status: safe.status },
    );
  }
}

async function draftWording(request: Request, assignmentId: string) {
  let input: z.infer<typeof WordingDraftInputSchema>;
  try {
    input = WordingDraftInputSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ messageKey: "errors.validation" }, { status: 400 });
  }
  try {
    const result = await fetchProtectedUpstream({
      method: "POST",
      path: `/api/v1/employee-evaluation/assignments/${assignmentId}/justification-drafts`,
      body: {
        schemaVersion: "evaluation-justification.v1",
        ...input,
        locale: "en",
      },
      schema: WordingDraftOutputSchema,
    });
    return NextResponse.json(result);
  } catch (error) {
    return protectedError(error);
  }
}

async function submitAssessment(
  request: Request,
  assignmentId: string,
  kind: "SELF" | "MANAGER_INITIAL",
) {
  let input: z.infer<typeof SubmitSchema>;
  try {
    input = SubmitSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ messageKey: "errors.validation" }, { status: 400 });
  }
  try {
    const confirmedAt = new Date().toISOString();
    const result = await fetchProtectedUpstream({
      method: "POST",
      path: `/api/v1/employee-evaluation/assignments/${assignmentId}/submissions`,
      body: {
        schemaVersion: 1,
        kind,
        expectedVersion: input.expectedVersion,
        idempotencyKey: randomUUID(),
        confirmedAt,
      },
      schema: SubmissionReceiptSchema,
    });
    return NextResponse.json({ status: "submitted", confirmedAt: result.confirmedAt });
  } catch (error) {
    return protectedError(error);
  }
}

function protectedError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { messageKey: "errors.internal", correlationId: randomUUID() },
      { status: 500 },
    );
  }
  const safe = safeWorkspaceError(error);
  return NextResponse.json(
    { messageKey: safe.messageKey, correlationId: safe.correlationId },
    { status: safe.status },
  );
}

function notFound() {
  return NextResponse.json({ messageKey: "errors.notFound" }, { status: 404 });
}

export const GET = () => notFound();
export const PATCH = () => notFound();
export const PUT = () => notFound();
export const DELETE = () => notFound();
