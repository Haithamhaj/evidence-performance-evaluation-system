import { randomUUID } from "node:crypto";

import {
  AcceptedEvidenceEventSchema,
  AcceptedUpdateEventSchema,
  ClarificationAnswerInputSchema,
  ClarificationStateSchema,
  ConfirmEvidenceInputSchema,
  ConfirmUpdateInputSchema,
  CreateManualEvidenceInputSchema,
  CreateGitHubEvidenceInputSchema,
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
  ConfirmVoiceTranscriptInputSchema,
  ReviseVoiceTranscriptInputSchema,
  StartVoiceUpdateInputSchema,
  VoiceUpdateSessionSchema,
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
  ContextReviewQueueSchema,
  ContextSuggestionCorrectionInputSchema,
  ContextSuggestionInputSchema,
} from "../../../../platform/context-intelligence-contracts";
import {
  openContextReviewHandle,
  sealContextReviewHandle,
} from "../../../../platform/context-intelligence-handles";
import { NextResponse } from "next/server";
import { z } from "zod";

import { WhatChangedProjectionSchema } from "../../../../platform/experience-events-contracts";
import { WebPreparedExperienceCompositionSchema } from "../../../../platform/experience-orchestration-contracts";

import {
  fetchProtectedUpstream,
  safeWorkspaceError,
  uploadProtectedSource,
} from "../../../../platform/workspace-api";

type Context = { readonly params: Promise<{ readonly path: string[] }> };

const UuidSchema = z.string().uuid();
const CurrentSessionSchema = z.object({ active: z.boolean(), userId: UuidSchema }).passthrough();
const ContextPrepareItemSchema = z.object({ sourceItemId: UuidSchema }).strict();
const StrictQueueItemSchema = z
  .object({
    kind: z.enum(["PROJECT_SUGGESTION", "TASK_DRAFT"]),
    id: UuidSchema,
    employeeId: UuidSchema,
    sourceItemId: UuidSchema,
    revision: z.number().int().positive(),
    projectId: UuidSchema.nullable().optional(),
    explanation: z.string().optional(),
    draft: z
      .object({
        title: z.string(),
        description: z.string(),
        projectId: UuidSchema.nullable(),
        workstreamId: UuidSchema.nullable(),
        proposedAssigneeId: UuidSchema.nullable(),
        dueAt: z.iso.datetime({ offset: true }).nullable(),
        acceptanceConditions: z.array(z.string()),
        uncertainties: z.array(z.string()),
      })
      .strict()
      .optional(),
    clarification: z
      .object({
        nextQuestion: z
          .object({ field: z.enum(["projectId", "assigneeId"]) })
          .strict()
          .nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();
const StrictQueueSchema = z
  .object({
    items: z.array(StrictQueueItemSchema),
  })
  .strict();
const RawQueueSchema = z.preprocess(projectQueueResponse, StrictQueueSchema);
const StrictSourceSchema = z
  .object({
    id: UuidSchema,
    provider: z.enum(["GOOGLE_GMAIL", "GOOGLE_CALENDAR"]).nullable(),
    occurredAt: z.iso.datetime({ offset: true }).nullable(),
    title: z.string(),
    summary: z.string().nullable(),
    sourceUrl: z.url().nullable(),
  })
  .strict();
const StrictSourcesSchema = z
  .object({
    items: z.array(StrictSourceSchema),
  })
  .strict();
const RawSourcesSchema = z.preprocess(projectSourcesResponse, StrictSourcesSchema);
const StrictProjectSchema = z
  .object({ id: UuidSchema, name: z.string().trim().min(1).max(240) })
  .strict();
const RawProjectsSchema = z.preprocess(projectProjectsResponse, z.array(StrictProjectSchema));
const UpstreamAcknowledgementSchema = z.preprocess(
  projectAcknowledgementResponse,
  z.object({}).strict(),
);
const StrictConfirmedTaskSchema = z
  .object({
    workItem: z.object({ title: z.string().trim().min(1).max(200) }).strict(),
  })
  .strict();
const UpstreamConfirmedTaskSchema = z.preprocess(
  projectConfirmedTaskResponse,
  StrictConfirmedTaskSchema,
);
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
    if (path.length === 2 && path[0] === "experience" && path[1] === "session") {
      return json(
        await fetchProtectedUpstream({
          method: "GET",
          path: "/api/v1/me",
          schema: CurrentSessionSchema,
        }),
      );
    }
    if (path.length === 2 && path[0] === "experience" && path[1] === "what-changed") {
      const afterCursor = new URL(request.url).searchParams.get("afterCursor");
      return json(
        await fetchProtectedUpstream({
          method: "GET",
          path: `/api/v1/experience/what-changed${afterCursor === null ? "" : `?afterCursor=${encodeURIComponent(afterCursor)}`}`,
          schema: WhatChangedProjectionSchema,
        }),
      );
    }
    if (path.length === 2 && path[0] === "experience" && path[1] === "prepared") {
      return json(
        await fetchProtectedUpstream({
          method: "GET",
          path: "/api/v1/experience-orchestration/prepared",
          schema: WebPreparedExperienceCompositionSchema,
        }),
      );
    }
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
      const [queue, sources, projects] = await Promise.all([
        fetchProtectedUpstream({
          method: "GET",
          path: "/api/v1/context/review-queue",
          schema: RawQueueSchema,
        }),
        fetchProtectedUpstream({
          method: "GET",
          path: "/api/v1/connected-work/items",
          schema: RawSourcesSchema,
        }),
        fetchProtectedUpstream({
          method: "GET",
          path: "/api/v1/projects",
          schema: RawProjectsSchema,
        }),
      ]);
      return json(ContextReviewQueueSchema.parse(projectReviewQueue(queue, sources, projects)));
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
    if (path.length === 3 && path.join("/") === "context/items/prepare") {
      const input = ContextPrepareItemSchema.parse(body);
      return protectedContextCall(async () => {
        await fetchProtectedUpstream({
          method: "POST",
          path: `/api/v1/context/items/${input.sourceItemId}/analyze`,
          body: {},
          schema: UpstreamAcknowledgementSchema,
        });
        await fetchProtectedUpstream({
          method: "POST",
          path: "/api/v1/context/task-drafts",
          body: { sourceItemId: input.sourceItemId },
          schema: UpstreamAcknowledgementSchema,
        });
        return json({});
      });
    }
    if (
      path.length === 3 &&
      path[0] === "context" &&
      path[1] === "project-suggestions" &&
      ["confirm", "correct"].includes(path[2]!)
    ) {
      const schema =
        path[2] === "confirm"
          ? ContextSuggestionInputSchema
          : ContextSuggestionCorrectionInputSchema;
      const input = schema.parse(body);
      const suggestion = openContextReviewHandle(input.handle, "project_suggestion");
      const projectHandle = (input as z.infer<typeof ContextSuggestionCorrectionInputSchema>)
        .projectHandle;
      const project =
        path[2] === "correct" && projectHandle !== null
          ? openContextReviewHandle(projectHandle, "project")
          : null;
      return protectedContextCall(async () => {
        await post(
          `/api/v1/context/project-suggestions/${suggestion.id}/${path[2]}`,
          path[2] === "confirm"
            ? { expectedRevision: suggestion.revision, reason: input.reason }
            : {
                expectedRevision: suggestion.revision,
                projectId: project?.projectId ?? null,
                reason: input.reason,
              },
          UpstreamAcknowledgementSchema,
        );
        return json({});
      });
    }
    if (
      path.length === 3 &&
      path[0] === "context" &&
      path[1] === "task-drafts" &&
      path[2] === "confirm"
    ) {
      const input = ContextConfirmTaskInputSchema.parse(body);
      const draft = openContextReviewHandle(input.handle, "task_draft");
      const project = openContextReviewHandle(input.draft.projectHandle, "project");
      return protectedContextCall(async () => {
        const upstream = await fetchProtectedUpstream({
          method: "POST",
          path: `/api/v1/context/task-drafts/${draft.id}/confirm`,
          body: {
            expectedRevision: draft.revision,
            reason: input.reason,
            draft: {
              title: input.draft.title,
              description: input.draft.description,
              projectId: project.projectId,
              workstreamId: draft.workstreamId ?? null,
              assigneeId: draft.employeeId,
              dueAt: draft.dueAt ?? null,
              acceptanceConditions: draft.acceptanceConditions ?? [],
            },
          },
          schema: UpstreamConfirmedTaskSchema,
        });
        return json(
          ContextConfirmTaskResultSchema.parse({ task: { title: upstream.workItem.title } }),
        );
      });
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
    if (path.length === 1 && path[0] === "voice-updates") {
      return await post(
        "/api/v1/voice-updates",
        StartVoiceUpdateInputSchema.parse(body),
        VoiceUpdateSessionSchema,
      );
    }
    if (path.length === 3 && path[0] === "voice-updates" && isUuid(path[1])) {
      if (path[2] === "revisions") {
        return await post(
          `/api/v1/voice-updates/${path[1]}/revisions`,
          ReviseVoiceTranscriptInputSchema.parse(body),
          VoiceUpdateSessionSchema,
        );
      }
      if (path[2] === "confirm") {
        return await post(
          `/api/v1/voice-updates/${path[1]}/confirm`,
          ConfirmVoiceTranscriptInputSchema.parse(body),
          VoiceUpdateSessionSchema,
        );
      }
      if (path[2] === "cancel") {
        return await post(`/api/v1/voice-updates/${path[1]}/cancel`, {}, VoiceUpdateSessionSchema);
      }
      if (path[2] === "retry") {
        return await post(`/api/v1/voice-updates/${path[1]}/retry`, {}, VoiceUpdateSessionSchema);
      }
    }
    if (
      path.length === 4 &&
      path[0] === "voice-updates" &&
      path[1] === "idempotency" &&
      isUuid(path[2]) &&
      path[3] === "cancel"
    ) {
      return await post(
        `/api/v1/voice-updates/idempotency/${path[2]}/cancel`,
        {},
        VoiceUpdateSessionSchema,
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
    if (path.length === 2 && path[0] === "evidence" && path[1] === "github-suggestions") {
      return await post(
        "/api/v1/evidence/github-suggestions",
        CreateGitHubEvidenceInputSchema.parse(body),
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

function projectQueueResponse(value: unknown): unknown {
  const response = objectValue(value);
  if (response === null) return value;
  return {
    items: Array.isArray(response.items) ? response.items.map(projectQueueItem) : response.items,
  };
}

function projectQueueItem(value: unknown): unknown {
  const item = objectValue(value);
  if (item === null) return value;
  return {
    kind: item.kind,
    id: item.id,
    employeeId: item.employeeId,
    sourceItemId: item.sourceItemId,
    revision: item.revision,
    ...(item.projectId === undefined ? {} : { projectId: item.projectId }),
    ...(item.explanation === undefined ? {} : { explanation: item.explanation }),
    ...(item.draft === undefined ? {} : { draft: projectDraft(item.draft) }),
    ...(item.clarification === undefined
      ? {}
      : { clarification: projectClarification(item.clarification) }),
  };
}

function projectDraft(value: unknown): unknown {
  const draft = objectValue(value);
  if (draft === null) return value;
  return {
    title: draft.title,
    description: draft.description,
    projectId: draft.projectId,
    workstreamId: draft.workstreamId,
    proposedAssigneeId: draft.proposedAssigneeId,
    dueAt: draft.dueAt,
    acceptanceConditions: draft.acceptanceConditions,
    uncertainties: draft.uncertainties,
  };
}

function projectClarification(value: unknown): unknown {
  const clarification = objectValue(value);
  if (clarification === null) return value;
  return {
    nextQuestion:
      clarification.nextQuestion === null ? null : projectNextQuestion(clarification.nextQuestion),
  };
}

function projectNextQuestion(value: unknown): unknown {
  const nextQuestion = objectValue(value);
  if (nextQuestion === null) return value;
  return { field: nextQuestion.field };
}

function projectSourcesResponse(value: unknown): unknown {
  const response = objectValue(value);
  if (response === null) return value;
  return {
    items: Array.isArray(response.items) ? response.items.map(projectSource) : response.items,
  };
}

function projectSource(value: unknown): unknown {
  const source = objectValue(value);
  if (source === null) return value;
  return {
    id: source.id,
    provider: source.provider ?? null,
    occurredAt: source.occurredAt ?? null,
    title: source.title,
    summary: source.summary,
    sourceUrl: source.sourceUrl,
  };
}

function projectProjectsResponse(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map(projectProject);
}

function projectProject(value: unknown): unknown {
  const project = objectValue(value);
  if (project === null) return value;
  return { id: project.id, name: project.name };
}

function projectAcknowledgementResponse(): Record<never, never> {
  return {};
}

function projectConfirmedTaskResponse(value: unknown): unknown {
  const response = objectValue(value);
  if (response === null) return value;
  const workItem = objectValue(response.workItem);
  return { workItem: workItem === null ? response.workItem : { title: workItem.title } };
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function projectReviewQueue(
  queue: z.infer<typeof RawQueueSchema>,
  sources: z.infer<typeof RawSourcesSchema>,
  projects: z.infer<typeof RawProjectsSchema>,
) {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const sourceById = new Map(sources.items.map((source) => [source.id, source]));
  const safeSource = (sourceItemId: string) => {
    const source = sourceById.get(sourceItemId);
    return source === undefined
      ? {
          provider: null,
          observedAt: null,
          title: "Private source context",
          summary: null,
          sourceUrl: null,
        }
      : {
          provider: source.provider,
          observedAt: source.occurredAt,
          title: source.title,
          summary: source.summary,
          sourceUrl: source.sourceUrl,
        };
  };
  const projectHandle = (projectId: string | null) =>
    projectId === null
      ? null
      : sealContextReviewHandle({ action: "project", id: projectId, projectId });
  return {
    items: queue.items.map((item) => {
      if (item.kind === "PROJECT_SUGGESTION") {
        const project =
          item.projectId === undefined || item.projectId === null
            ? undefined
            : projectById.get(item.projectId);
        return {
          kind: "project_match" as const,
          handle: sealContextReviewHandle({
            action: "project_suggestion",
            id: item.id,
            revision: item.revision,
          }),
          projectName: project?.name ?? null,
          explanation: item.explanation ?? "Prepared Project link needs your review.",
          source: safeSource(item.sourceItemId),
        };
      }
      const draft = item.draft!;
      const project = draft.projectId === null ? undefined : projectById.get(draft.projectId);
      return {
        kind: "task_draft" as const,
        handle: sealContextReviewHandle({
          action: "task_draft",
          id: item.id,
          revision: item.revision,
          employeeId: item.employeeId,
          workstreamId: draft.workstreamId,
          dueAt: draft.dueAt,
          acceptanceConditions: draft.acceptanceConditions,
        }),
        title: draft.title,
        description: draft.description,
        projectHandle: projectHandle(draft.projectId),
        projectName: project?.name ?? null,
        dueAt: draft.dueAt,
        acceptanceConditions: draft.acceptanceConditions,
        uncertainties: draft.uncertainties,
        clarification: {
          nextQuestion:
            item.clarification?.nextQuestion === null
              ? null
              : item.clarification?.nextQuestion?.field === "projectId"
                ? "project"
                : "assignee",
        },
        source: safeSource(item.sourceItemId),
      };
    }),
    projects: projects.map((project) => ({
      handle: sealContextReviewHandle({ action: "project", id: project.id, projectId: project.id }),
      name: project.name,
    })),
  };
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

async function protectedContextCall(action: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await action();
  } catch (error) {
    return safeError(error);
  }
}

export const PUT = () => notFound();
export const DELETE = () => notFound();
export const HEAD = () => notFound();
export const OPTIONS = () => notFound();
