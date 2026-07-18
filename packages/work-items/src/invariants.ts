import { AppError } from "@evaluation/contracts";

type WorkItemStatus =
  "planned" | "ready" | "in_progress" | "blocked" | "in_review" | "done" | "cancelled";

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
  let isAllowed = false;

  switch (from) {
    case "planned":
      isAllowed = to === "ready" || to === "cancelled";
      break;
    case "ready":
      isAllowed = to === "in_progress" || to === "blocked" || to === "cancelled";
      break;
    case "in_progress":
      isAllowed = to === "blocked" || to === "in_review" || to === "done" || to === "cancelled";
      break;
    case "blocked":
      isAllowed = to === "ready" || to === "in_progress" || to === "cancelled";
      break;
    case "in_review":
      isAllowed = to === "in_progress" || to === "blocked" || to === "done" || to === "cancelled";
      break;
    case "done":
    case "cancelled":
      isAllowed = false;
      break;
  }

  if (!isAllowed) {
    throw new AppError("WORK_ITEM_STATE_INVALID", "errors.workItems.stateInvalid", 409);
  }
}
