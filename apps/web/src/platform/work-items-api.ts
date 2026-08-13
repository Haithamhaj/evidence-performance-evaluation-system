import type { z } from "zod";

import {
  WebUuidSchema,
  WebTaskWorkspaceResponseSchema,
  WebWorkItemDependenciesSchema,
  WebWorkItemSchema,
} from "./task-workspace-contracts";
import { TimelineResponseSchema } from "./updates-evidence-contracts";

export type WebWorkItem = z.infer<typeof WebWorkItemSchema>;
export type WorkItemStatus = WebWorkItem["status"];
export type WorkItemContextEntry = Readonly<{
  id: string;
  kind: "evidence" | "update";
  title: string;
  detail: string;
  occurredAt: string;
  sourceProvenance: import("./updates-evidence-contracts").TimelineItem["sourceProvenance"];
  reviewState: import("./updates-evidence-contracts").TimelineItem["reviewState"];
}>;
export type WorkItemContext = Readonly<{
  updates: readonly WorkItemContextEntry[];
  evidence: readonly WorkItemContextEntry[];
}>;
export type WorkItemDependencies = z.infer<typeof WebWorkItemDependenciesSchema>;
export type WebTaskWorkspaceResponse = z.infer<typeof WebTaskWorkspaceResponseSchema>;

export class WorkItemGatewayError extends Error {
  constructor(readonly status: number) {
    super(`Work Item request failed (${status})`);
  }
}

export async function listWorkItems(input: {
  readonly layout: "board" | "calendar" | "list";
  readonly view: "my" | "team";
  readonly projectId: string | null;
  readonly status: WorkItemStatus | null;
  readonly search: string | null;
  readonly sort: "due_asc" | "updated_desc" | "priority_desc";
  readonly cursor?: string | null;
}): Promise<WebTaskWorkspaceResponse> {
  const query = new URLSearchParams({ layout: input.layout, sort: input.sort, view: input.view });
  if (input.projectId !== null) query.set("projectId", WebUuidSchema.parse(input.projectId));
  if (input.status !== null) query.set("status", input.status);
  if (input.search !== null) query.set("search", input.search);
  if (input.cursor !== undefined && input.cursor !== null) {
    query.set("cursor", WebUuidSchema.parse(input.cursor));
  }
  const response = await fetch(`/api/daily-work/work-items?${query.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new WorkItemGatewayError(response.status);
  return WebTaskWorkspaceResponseSchema.parse(await response.json());
}

export async function loadWorkItem(id: string): Promise<WebWorkItem> {
  return request(`/api/daily-work/work-items/${WebUuidSchema.parse(id)}`);
}

export async function loadWorkItemDependencies(id: string): Promise<WorkItemDependencies> {
  const response = await fetch(
    `/api/daily-work/work-items/${WebUuidSchema.parse(id)}/dependencies`,
    {
      cache: "no-store",
    },
  );
  if (!response.ok) throw new WorkItemGatewayError(response.status);
  return WebWorkItemDependenciesSchema.parse(await response.json());
}

export async function replaceWorkItemDependencies(
  id: string,
  input: {
    readonly dependsOnWorkItemIds: readonly string[];
    readonly expectedVersion: number;
    readonly reason: string;
  },
): Promise<WorkItemDependencies> {
  const response = await fetch(
    `/api/daily-work/work-items/${WebUuidSchema.parse(id)}/dependencies`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) throw new WorkItemGatewayError(response.status);
  return WebWorkItemDependenciesSchema.parse(await response.json());
}

export async function loadWorkItemContext(input: {
  readonly itemId: string;
  readonly projectId: string;
}): Promise<WorkItemContext> {
  const itemId = WebUuidSchema.parse(input.itemId);
  const projectId = WebUuidSchema.parse(input.projectId);
  const response = await fetch(`/api/daily-work/timeline?projectId=${projectId}&limit=20`, {
    cache: "no-store",
  });
  if (!response.ok) throw new WorkItemGatewayError(response.status);
  const entries = TimelineResponseSchema.parse(await response.json())
    .items.filter(
      (entry) =>
        entry.projectId === projectId &&
        entry.workItemId === itemId &&
        (entry.kind === "update" || entry.kind === "evidence"),
    )
    .map((entry) => ({
      id: entry.id,
      kind: entry.kind as "evidence" | "update",
      title: entry.title,
      detail: entry.detail,
      occurredAt: entry.occurredAt,
      sourceProvenance: entry.sourceProvenance,
      reviewState: entry.reviewState,
    }));
  return {
    updates: entries.filter((entry) => entry.kind === "update"),
    evidence: entries.filter((entry) => entry.kind === "evidence"),
  };
}

export async function createWorkItem(input: {
  readonly clientRequestId: string;
  readonly employeeId: string;
  readonly projectId: string;
  readonly title: string;
}): Promise<WebWorkItem> {
  return request("/api/daily-work/work-items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientRequestId: WebUuidSchema.parse(input.clientRequestId),
      title: input.title,
      description: "",
      projectId: input.projectId,
      workstreamId: null,
      assigneeId: input.employeeId,
      dueAt: null,
      priority: "normal",
      requirements: [],
      acceptanceConditions: [],
      blocker: null,
      nextAction: null,
    }),
  });
}

export async function transitionWorkItem(
  id: string,
  input: {
    readonly status: WorkItemStatus;
    readonly expectedVersion: number;
    readonly reason: string;
  },
): Promise<WebWorkItem> {
  return request(`/api/daily-work/work-items/${WebUuidSchema.parse(id)}/transitions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateWorkItem(
  id: string,
  input: {
    readonly title: string;
    readonly priority: WebWorkItem["priority"];
    readonly dueAt: string | null;
    readonly expectedVersion: number;
    readonly reason: string;
  },
): Promise<WebWorkItem> {
  return request(`/api/daily-work/work-items/${WebUuidSchema.parse(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

async function request(path: string, init?: RequestInit): Promise<WebWorkItem> {
  const response = await fetch(path, init);
  if (!response.ok) throw new WorkItemGatewayError(response.status);
  return WebWorkItemSchema.parse(await response.json());
}
