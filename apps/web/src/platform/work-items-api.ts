import type { z } from "zod";

import { WebUuidSchema, WebWorkItemSchema } from "./task-workspace-contracts";

export type WebWorkItem = z.infer<typeof WebWorkItemSchema>;
export type WorkItemStatus = WebWorkItem["status"];

export class WorkItemGatewayError extends Error {
  constructor(readonly status: number) {
    super(`Work Item request failed (${status})`);
  }
}

export async function loadWorkItem(id: string): Promise<WebWorkItem> {
  return request(`/api/daily-work/work-items/${WebUuidSchema.parse(id)}`);
}

export async function createWorkItem(input: {
  readonly employeeId: string;
  readonly projectId: string;
  readonly title: string;
}): Promise<WebWorkItem> {
  return request("/api/daily-work/work-items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
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

async function request(path: string, init?: RequestInit): Promise<WebWorkItem> {
  const response = await fetch(path, init);
  if (!response.ok) throw new WorkItemGatewayError(response.status);
  return WebWorkItemSchema.parse(await response.json());
}
