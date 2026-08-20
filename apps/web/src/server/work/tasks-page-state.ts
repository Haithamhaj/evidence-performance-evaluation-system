import { WebUuidSchema } from "../../platform/task-workspace-contracts";

type TasksPageQuery = Readonly<{
  item?: string;
  layout?: string;
  project?: string;
  q?: string;
  sort?: string;
  status?: string;
  view?: string;
}>;

export function buildTasksPageState(locale: "ar" | "en", query: TasksPageQuery) {
  const layout = ["list", "board", "calendar"].includes(query.layout ?? "")
    ? (query.layout as "list" | "board" | "calendar")
    : "list";
  const view = query.view === "team" ? "team" : "my";
  const parsedItem = WebUuidSchema.safeParse(query.item);
  const selectedId = parsedItem.success ? parsedItem.data : null;
  const parsedProject = WebUuidSchema.safeParse(query.project);
  const projectId = parsedProject.success ? parsedProject.data : null;
  const statuses = ["planned", "ready", "in_progress", "blocked", "in_review", "done", "cancelled"];
  const status = statuses.includes(query.status ?? "")
    ? (query.status as import("../../platform/work-items-api").WorkItemStatus)
    : null;
  const sorts = ["due_asc", "updated_desc", "priority_desc"] as const;
  const sort = sorts.includes(query.sort as (typeof sorts)[number])
    ? (query.sort as (typeof sorts)[number])
    : "due_asc";
  const normalizedSearch = query.q?.trim() ?? "";
  const searchText = normalizedSearch.slice(0, 200);
  const search = new URLSearchParams({ view, layout });
  if (selectedId !== null) search.set("item", selectedId);
  if (projectId !== null) search.set("project", projectId);
  if (status !== null) search.set("status", status);
  if (searchText !== "") search.set("q", searchText);
  if (sort !== "due_asc") search.set("sort", sort);
  return {
    href: `/${locale}/tasks?${search.toString()}`,
    layout,
    projectId,
    search: searchText === "" ? null : searchText,
    selectedId,
    sort,
    status,
    view,
  } as const;
}
