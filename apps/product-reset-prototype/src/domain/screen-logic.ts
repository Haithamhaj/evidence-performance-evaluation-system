import type { WorkItem } from "./types";

export type MyWorkGroups = {
  readonly needsAction: readonly WorkItem[];
  readonly overdue: readonly WorkItem[];
  readonly today: readonly WorkItem[];
  readonly thisWeek: readonly WorkItem[];
  readonly blocked: readonly WorkItem[];
  readonly reviews: readonly WorkItem[];
  readonly noDueDate: readonly WorkItem[];
};

const day = 86_400_000;

export function groupMyWork(items: readonly WorkItem[], todayIso: string): MyWorkGroups {
  const result: Record<keyof MyWorkGroups, WorkItem[]> = {
    needsAction: [],
    overdue: [],
    today: [],
    thisWeek: [],
    blocked: [],
    reviews: [],
    noDueDate: [],
  };
  const today = Date.parse(`${todayIso}T00:00:00Z`);

  for (const item of items) {
    if (item.status === "done" || item.status === "cancelled") continue;
    const due = item.dueDate === null ? null : Date.parse(`${item.dueDate}T00:00:00Z`);

    if (due !== null && due < today - day) result.overdue.push(item);
    else if (item.status === "blocked") result.blocked.push(item);
    else if (item.status === "in_review") result.reviews.push(item);
    else if (item.primaryAssignee === "نورة الشمري" && item.status === "ready") {
      result.needsAction.push(item);
    } else if (due === today) result.today.push(item);
    else if (due !== null && due <= today + 7 * day) result.thisWeek.push(item);
    else if (due === null) result.noDueDate.push(item);
    else result.thisWeek.push(item);
  }

  return result;
}

export function projectProgress(items: readonly WorkItem[], projectId: string) {
  const matching = items.filter((item) => item.projectId === projectId);
  const completed = matching.filter((item) => item.status === "done").length;
  return {
    completed,
    total: matching.length,
    percent: matching.length === 0 ? 0 : Math.round((completed / matching.length) * 100),
  };
}
