import { randomUUID } from "node:crypto";

import {
  AcceptedEvidenceEventSchema,
  AcceptedUpdateEventSchema,
  ClarificationAnswerInputSchema,
  ClarificationStateSchema,
  ConfirmEvidenceInputSchema,
  ConfirmUpdateInputSchema,
  CreateManualEvidenceInputSchema,
  EvidenceDetailSchema,
  EvidenceReviewSchema,
  RejectEvidenceInputSchema,
  ReviseEvidenceInputSchema,
  ReviseUpdateDraftInputSchema,
  StartTextUpdateInputSchema,
  StructuredUpdateDraftSchema,
  TimelineResponseSchema,
} from "../../../../platform/updates-evidence-contracts";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  fetchProtectedUpstream,
  safeWorkspaceError,
} from "../../../../platform/workspace-api";

type Context = { readonly params: Promise<{ readonly path: string[] }> };

const UuidSchema = z.string().uuid();
const TimelineQuerySchema = z
  .object({
    projectId: UuidSchema,
    workstreamId: UuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(1_000).optional(),
  })
  .strict();

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  const path = (await context.params).path;
  if (!safeRequestPath(request, path)) return notFound();
  try {
    if (path.length === 1 && path[0] === "timeline") {
      const entries = [...new URL(request.url).searchParams.entries()];
      if (new Set(entries.map(([key]) => key)).size !== entries.length) return notFound();
      const query = TimelineQuerySchema.parse(Object.fromEntries(entries));
      const params = new URLSearchParams({
        projectId: query.projectId,
        limit: String(query.limit),
      });
      if (query.workstreamId !== undefined) params.set("workstreamId", query.workstreamId);
      if (query.cursor !== undefined) params.set("cursor", query.cursor);
      return json(
        await fetchProtectedUpstream({
          path: `/api/v1/timeline?${params.toString()}`,
          schema: TimelineResponseSchema,
        }),
      );
    }
    if (new URL(request.url).search !== "") return notFound();
    if (path.length === 3 && path[0] === "updates" && isUuid(path[1]) && path[2] === "draft") {
      return json(
        await fetchProtectedUpstream({
          path: `/api/v1/updates/${path[1]}/draft`,
          schema: StructuredUpdateDraftSchema,
        }),
      );
    }
    if (path.length === 2 && path[0] === "evidence" && isUuid(path[1])) {
      return json(
        await fetchProtectedUpstream({
          path: `/api/v1/evidence/${path[1]}`,
          schema: EvidenceReviewSchema,
        }),
      );
    }
    return notFound();
  } catch (error) {
    if (error instanceof z.ZodError) return notFound();
    return safeError(error);
  }
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const path = (await context.params).path;
  if (!safeRequestPath(request, path) || new URL(request.url).search !== "") return notFound();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid();
  }
  try {
    if (path.length === 2 && path[0] === "updates" && path[1] === "text") {
      return await post(
        "/api/v1/updates/text",
        StartTextUpdateInputSchema.parse(body),
        ClarificationStateSchema,
      );
    }
    if (path.length === 3 && path[0] === "updates" && isUuid(path[1])) {
      if (path[2] === "answers") {
        return await post(
          `/api/v1/updates/${path[1]}/answers`,
          ClarificationAnswerInputSchema.parse(body),
          ClarificationStateSchema,
        );
      }
      if (path[2] === "revisions") {
        return await post(
          `/api/v1/updates/${path[1]}/revisions`,
          ReviseUpdateDraftInputSchema.parse(body),
          StructuredUpdateDraftSchema,
        );
      }
      if (path[2] === "confirm") {
        return await post(
          `/api/v1/updates/${path[1]}/confirm`,
          ConfirmUpdateInputSchema.parse(body),
          AcceptedUpdateEventSchema,
        );
      }
    }
    if (path.length === 1 && path[0] === "evidence") {
      return await post(
        "/api/v1/evidence",
        CreateManualEvidenceInputSchema.parse(body),
        EvidenceDetailSchema,
      );
    }
    if (path.length === 3 && path[0] === "evidence" && isUuid(path[1])) {
      if (path[2] === "revisions") {
        return await post(
          `/api/v1/evidence/${path[1]}/revisions`,
          ReviseEvidenceInputSchema.parse(body),
          EvidenceDetailSchema,
        );
      }
      if (path[2] === "confirm") {
        return await post(
          `/api/v1/evidence/${path[1]}/confirm`,
          ConfirmEvidenceInputSchema.parse(body),
          AcceptedEvidenceEventSchema,
        );
      }
      if (path[2] === "reject") {
        return await post(
          `/api/v1/evidence/${path[1]}/reject`,
          RejectEvidenceInputSchema.parse(body),
          EvidenceDetailSchema,
        );
      }
    }
    return notFound();
  } catch (error) {
    if (error instanceof z.ZodError) return invalid();
    return safeError(error);
  }
}

async function post<T>(
  path: string,
  body: unknown,
  schema: { parse(value: unknown): T },
): Promise<NextResponse> {
  return json(
    await fetchProtectedUpstream({
      path,
      schema,
      method: "POST",
      body,
    }),
  );
}

function safeRequestPath(request: Request, path: readonly string[]): boolean {
  return (
    !/%(?:2e|2f|5c)/iu.test(request.url) &&
    path.length > 0 &&
    path.every((segment) => segment !== "." && segment !== ".." && !segment.includes("/"))
  );
}

function isUuid(value: string | undefined): value is string {
  return value !== undefined && UuidSchema.safeParse(value).success;
}

function json(value: unknown): NextResponse {
  return NextResponse.json(value, { status: 200 });
}

function invalid(): NextResponse {
  return NextResponse.json(
    { messageKey: "errors.validation", correlationId: randomUUID() },
    { status: 409 },
  );
}

function notFound(): NextResponse {
  return NextResponse.json(
    { messageKey: "errors.notFound", correlationId: randomUUID() },
    { status: 404 },
  );
}

function safeError(error: unknown): NextResponse {
  const safe = safeWorkspaceError(error);
  return NextResponse.json(
    { messageKey: safe.messageKey, correlationId: safe.correlationId },
    { status: safe.status },
  );
}

export const PUT = () => notFound();
export const PATCH = () => notFound();
export const DELETE = () => notFound();
export const HEAD = () => notFound();
export const OPTIONS = () => notFound();
