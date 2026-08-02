import { z } from "zod";

import {
  ContextConfirmTaskResultSchema,
  ContextProjectSuggestionSchema,
  ContextReviewQueueSchema,
  ContextTaskDraftSchema,
} from "./context-intelligence-contracts";

const UuidSchema = z.string().uuid();
export type ContextProjectSuggestion = z.infer<typeof ContextProjectSuggestionSchema>;
export type ContextTaskDraft = z.infer<typeof ContextTaskDraftSchema>;
export type ContextReviewQueue = z.infer<typeof ContextReviewQueueSchema>;

export async function listContextReviewQueue(): Promise<ContextReviewQueue> {
  return request(
    "/api/daily-work/context/review-queue",
    "GET",
    undefined,
    ContextReviewQueueSchema,
  );
}

export async function analyzeContextItem(sourceItemId: string) {
  return request(
    `/api/daily-work/context/items/${UuidSchema.parse(sourceItemId)}/analyze`,
    "POST",
    {},
    z.unknown(),
  );
}

export async function confirmProjectSuggestion(input: {
  readonly id: string;
  readonly expectedRevision: number;
  readonly reason: string;
}) {
  return request(
    `/api/daily-work/context/project-suggestions/${UuidSchema.parse(input.id)}/confirm`,
    "POST",
    { expectedRevision: input.expectedRevision, reason: input.reason },
    ContextProjectSuggestionSchema,
  );
}

export async function correctProjectSuggestion(input: {
  readonly id: string;
  readonly expectedRevision: number;
  readonly projectId: string | null;
  readonly reason: string;
}) {
  return request(
    `/api/daily-work/context/project-suggestions/${UuidSchema.parse(input.id)}/correct`,
    "POST",
    {
      expectedRevision: input.expectedRevision,
      projectId: input.projectId === null ? null : UuidSchema.parse(input.projectId),
      reason: input.reason,
    },
    ContextProjectSuggestionSchema,
  );
}

export async function prepareTaskDraft(sourceItemId: string): Promise<ContextTaskDraft> {
  return request(
    "/api/daily-work/context/task-drafts",
    "POST",
    { sourceItemId: UuidSchema.parse(sourceItemId) },
    ContextTaskDraftSchema.extend({ kind: z.literal("TASK_DRAFT") }).strict(),
  );
}

export async function confirmTaskDraft(input: {
  readonly id: string;
  readonly expectedRevision: number;
  readonly reason: string;
  readonly draft: {
    readonly title: string;
    readonly description: string;
    readonly projectId: string;
    readonly workstreamId: string | null;
    readonly assigneeId: string;
    readonly dueAt: string | null;
    readonly acceptanceConditions: readonly string[];
  };
}) {
  return request(
    `/api/daily-work/context/task-drafts/${UuidSchema.parse(input.id)}/confirm`,
    "POST",
    {
      expectedRevision: input.expectedRevision,
      reason: input.reason,
      draft: input.draft,
    },
    ContextConfirmTaskResultSchema,
  );
}

async function request<T>(
  path: string,
  method: "GET" | "POST",
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error("CONTEXT_INTELLIGENCE_REQUEST_FAILED");
  return schema.parse(await response.json());
}
