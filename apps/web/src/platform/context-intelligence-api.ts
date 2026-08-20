import { z } from "zod";

import {
  ContextConfirmTaskResultSchema,
  ContextProjectMatchSchema,
  ContextReviewQueueSchema,
  ContextTaskDraftSchema,
} from "./context-intelligence-contracts";

export type ContextProjectSuggestion = z.infer<typeof ContextProjectMatchSchema>;
export type ContextTaskDraft = z.infer<typeof ContextTaskDraftSchema>;
export type ContextReviewQueue = z.infer<typeof ContextReviewQueueSchema>;

export class ContextDecisionError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("CONTEXT_INTELLIGENCE_REQUEST_FAILED");
    this.name = "ContextDecisionError";
    this.status = status;
  }
}

export async function listContextReviewQueue(): Promise<ContextReviewQueue> {
  return request(
    "/api/daily-work/context/review-queue",
    "GET",
    undefined,
    ContextReviewQueueSchema,
  );
}

export async function prepareContextReview(sourceItemId: string) {
  return request(
    "/api/daily-work/context/items/prepare",
    "POST",
    { sourceItemId },
    z.object({}).strict(),
  );
}

export async function confirmProjectSuggestion(input: {
  readonly handle: string;
  readonly reason: string;
}) {
  return request(
    "/api/daily-work/context/project-suggestions/confirm",
    "POST",
    { handle: input.handle, reason: input.reason },
    z.object({}).strict(),
  );
}

export async function correctProjectSuggestion(input: {
  readonly handle: string;
  readonly projectHandle: string | null;
  readonly reason: string;
}) {
  return request(
    "/api/daily-work/context/project-suggestions/correct",
    "POST",
    {
      handle: input.handle,
      projectHandle: input.projectHandle,
      reason: input.reason,
    },
    z.object({}).strict(),
  );
}

export async function dismissProjectSuggestion(input: {
  readonly handle: string;
  readonly reason: string;
}) {
  return correctProjectSuggestion({
    handle: input.handle,
    projectHandle: null,
    reason: input.reason,
  });
}

export async function confirmTaskDraft(input: {
  readonly handle: string;
  readonly reason: string;
  readonly draft: {
    readonly title: string;
    readonly description: string;
    readonly projectHandle: string;
    readonly assignToYou: true;
  };
}) {
  return request(
    "/api/daily-work/context/task-drafts/confirm",
    "POST",
    {
      handle: input.handle,
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
  if (!response.ok) throw new ContextDecisionError(response.status);
  return schema.parse(await response.json());
}
