import { AppError } from "@evaluation/contracts";

type WorkItemStatus =
  "planned" | "ready" | "in_progress" | "blocked" | "in_review" | "done" | "cancelled";

const allowedTransitions = {
  planned: ["ready", "cancelled"],
  ready: ["in_progress", "blocked", "cancelled"],
  in_progress: ["blocked", "in_review", "done", "cancelled"],
  blocked: ["ready", "in_progress", "cancelled"],
  in_review: ["in_progress", "blocked", "done", "cancelled"],
  done: [],
  cancelled: [],
} as const satisfies Readonly<Record<WorkItemStatus, readonly WorkItemStatus[]>>;

export function getAllowedWorkItemTransitions(status: WorkItemStatus): readonly WorkItemStatus[] {
  return allowedTransitions[status];
}

export function assertWorkItemScope(input: {
  projectId: string;
  workstream: Readonly<{ id: string; projectId: string }> | null;
}): void {
  if (input.projectId.length === 0 || input.workstream?.projectId !== input.projectId) {
    if (input.workstream === null && input.projectId.length > 0) return;
    throw new AppError("WORK_ITEM_SCOPE_MISMATCH", "errors.workItems.scopeMismatch", 400);
  }
}

export function assertWorkItemTransition(from: WorkItemStatus, to: WorkItemStatus): void {
  if (!getAllowedWorkItemTransitions(from).some((status) => status === to)) {
    throw new AppError("WORK_ITEM_STATE_INVALID", "errors.workItems.stateInvalid", 409);
  }
}
