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
  UpdateResultCardSchema,
  UploadedEvidenceSourceSchema,
} from "../../../../platform/updates-evidence-contracts";
import {
  AppliedProgressContractDraftSchema,
  ApplyProgressContractDraftInputSchema,
  CreateProgressContractDraftInputSchema,
  ProgressContractDecisionBodySchema,
  PublicProgressContractDecisionResultSchema,
  PublicProgressContractDraftSchema,
  RejectProgressContractDraftInputSchema,
  ReviseProgressContractDraftInputSchema,
} from "../../../../platform/progress-contract-drafts";
import {
  CapturePrivateInboxBodySchema,
  CreateTaskBodySchema,
  DismissPrivateInboxBodySchema,
  PromotePrivateInboxBodySchema,
  UpdateTaskBodySchema,
  WebPrivateInboxItemSchema,
  WebWorkItemSchema,
} from "../../../../platform/task-workspace-contracts";
import {
  ContextConfirmTaskInputSchema,
  ContextConfirmTaskResultSchema,
  ContextPrepareTaskInputSchema,
  ContextProjectSuggestionSchema,
  ContextReviewQueueSchema,
  ContextSuggestionCorrectionInputSchema,
  ContextSuggestionInputSchema,
  ContextTaskDraftSchema,
} from "../../../../platform/context-intelligence-contracts";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  fetchProtectedUpstream,
  safeWorkspaceError,
  uploadProtectedSource,
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
const UploadMetadataSchema = z
  .object({
    projectId: UuidSchema,
    workstreamId: UuidSchema.nullable(),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();
const MAX_EVIDENCE_UPLOAD_BYTES = 10 * 1024 * 1024;

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
    if (path.length === 2 && path[0] === "context" && path[1] === "review-queue") {
      return json(
        await fetchProtectedUpstream({
          method: "GET",
          path: "/api/v1/context/review-queue",
          schema: ContextReviewQueueSchema,
        }),
      );
    }
    if (new URL(request.url).search !== "") return notFound();
    if (
      path.length === 4 &&
      path[0] === "projects" &&
      isUuid(path[1]) &&
      path[2] === "progress-contract-drafts" &&
      isUuid(path[3])
    ) {
      return json(
        await fetchProtectedUpstream({
          path: `/api/v1/projects/${path[1]}/progress-contract-drafts/${path[3]}`,
          schema: PublicProgressContractDraftSchema,
        }),
      );
    }
    if (path.length === 3 && path[0] === "updates" && isUuid(path[1]) && path[2] === "draft") {
      return json(
        await fetchProtectedUpstream({
          path: `/api/v1/updates/${path[1]}/draft`,
          schema: StructuredUpdateDraftSchema,
        }),
      );
    }
    if (path.length === 3 && path[0] === "updates" && isUuid(path[1]) && path[2] === "result") {
      return json(
        await fetchProtectedUpstream({
          path: `/api/v1/updates/${path[1]}/result`,
          schema: UpdateResultCardSchema,
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
  if (path.length === 2 && path[0] === "evidence" && path[1] === "uploads") {
    return uploadEvidence(request);
  }
  let body: unknown;
  try {
    body = await request.json();
    if (path.length === 2 && path[0] === "context" && path[1] === "task-drafts") {
      return await post(
        "/api/v1/context/task-drafts",
        ContextPrepareTaskInputSchema.parse(body),
        ContextTaskDraftSchema.extend({ kind: z.literal("TASK_DRAFT") }).strict(),
      );
    }
    if (
      path.length === 4 &&
      path[0] === "context" &&
      path[1] === "project-suggestions" &&
      isUuid(path[2]) &&
      ["confirm", "correct"].includes(path[3]!)
    ) {
      const schema =
        path[3] === "confirm"
          ? ContextSuggestionInputSchema
          : ContextSuggestionCorrectionInputSchema;
      return await post(
        `/api/v1/context/project-suggestions/${path[2]}/${path[3]}`,
        schema.parse(body),
        ContextProjectSuggestionSchema,
      );
    }
    if (
      path.length === 4 &&
      path[0] === "context" &&
      path[1] === "task-drafts" &&
      isUuid(path[2]) &&
      path[3] === "confirm"
    ) {
      return await post(
        `/api/v1/context/task-drafts/${path[2]}/confirm`,
        ContextConfirmTaskInputSchema.parse(body),
        ContextConfirmTaskResultSchema,
      );
    }
  } catch {
    return invalid();
  }
  try {
    if (path.length === 1 && path[0] === "private-inbox") {
      return await post(
        "/api/v1/private-inbox",
        CapturePrivateInboxBodySchema.parse(body),
        WebPrivateInboxItemSchema,
      );
    }
    if (path.length === 1 && path[0] === "work-items") {
      return await post("/api/v1/work-items", CreateTaskBodySchema.parse(body), WebWorkItemSchema);
    }
    if (
      path.length === 3 &&
      path[0] === "private-inbox" &&
      isUuid(path[1]) &&
      path[2] === "promote"
    ) {
      return await post(
        `/api/v1/private-inbox/${path[1]}/promote`,
        PromotePrivateInboxBodySchema.parse(body),
        WebWorkItemSchema,
      );
    }
    if (
      path.length === 3 &&
      path[0] === "private-inbox" &&
      isUuid(path[1]) &&
      path[2] === "dismiss"
    ) {
      return await post(
        `/api/v1/private-inbox/${path[1]}/dismiss`,
        DismissPrivateInboxBodySchema.parse(body),
        WebPrivateInboxItemSchema,
      );
    }
    if (
      path.length === 3 &&
      path[0] === "projects" &&
      isUuid(path[1]) &&
      path[2] === "progress-contract-drafts"
    ) {
      return await post(
        `/api/v1/projects/${path[1]}/progress-contract-drafts`,
        CreateProgressContractDraftInputSchema.parse(body),
        PublicProgressContractDraftSchema,
      );
    }
    if (
      path.length === 5 &&
      path[0] === "projects" &&
      isUuid(path[1]) &&
      path[2] === "progress-contract-drafts" &&
      isUuid(path[3])
    ) {
      if (path[4] === "revisions") {
        return await post(
          `/api/v1/projects/${path[1]}/progress-contract-drafts/${path[3]}/revisions`,
          ReviseProgressContractDraftInputSchema.parse(body),
          PublicProgressContractDraftSchema,
        );
      }
      if (path[4] === "apply") {
        return await post(
          `/api/v1/projects/${path[1]}/progress-contract-drafts/${path[3]}/apply`,
          ApplyProgressContractDraftInputSchema.parse(body),
          AppliedProgressContractDraftSchema,
        );
      }
      if (path[4] === "reject") {
        return await post(
          `/api/v1/projects/${path[1]}/progress-contract-drafts/${path[3]}/reject`,
          RejectProgressContractDraftInputSchema.parse(body),
          PublicProgressContractDraftSchema,
        );
      }
    }
    if (
      path.length === 5 &&
      path[0] === "projects" &&
      isUuid(path[1]) &&
      path[2] === "progress-contracts" &&
      isUuid(path[3]) &&
      ["submit", "approve"].includes(path[4]!)
    ) {
      return await post(
        `/api/v1/projects/${path[1]}/progress-contracts/${path[3]}/${path[4]}`,
        ProgressContractDecisionBodySchema.parse(body),
        PublicProgressContractDecisionResultSchema,
      );
    }
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

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const path = (await context.params).path;
  if (
    !safeRequestPath(request, path) ||
    new URL(request.url).search !== "" ||
    path.length !== 2 ||
    path[0] !== "work-items" ||
    !isUuid(path[1])
  ) {
    return notFound();
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid();
  }
  try {
    return json(
      await fetchProtectedUpstream({
        path: `/api/v1/work-items/${path[1]}`,
        schema: WebWorkItemSchema,
        method: "PATCH",
        body: UpdateTaskBodySchema.parse(body),
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError) return invalid();
    return safeError(error);
  }
}

async function uploadEvidence(request: Request): Promise<NextResponse> {
  try {
    const form = await request.formData();
    if ([...form.keys()].some((key) => !["file", "metadata"].includes(key))) return invalid();
    const file = form.get("file");
    const metadataValue = form.get("metadata");
    if (!(file instanceof File) || typeof metadataValue !== "string") return invalid();
    if (file.size < 1 || file.size > MAX_EVIDENCE_UPLOAD_BYTES) return invalid();
    const metadata = UploadMetadataSchema.parse(JSON.parse(metadataValue));
    const resourceKind = metadata.workstreamId === null ? "project" : "workstream";
    const resourceId = metadata.workstreamId ?? metadata.projectId;
    return json(
      await uploadProtectedSource({
        resourceKind,
        resourceId,
        filename: file.name,
        declaredMime: file.type,
        reason: metadata.reason,
        bytes: await file.arrayBuffer(),
        schema: UploadedEvidenceSourceSchema,
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return invalid();
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
    { status: 400 },
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
export const DELETE = () => notFound();
export const HEAD = () => notFound();
export const OPTIONS = () => notFound();
