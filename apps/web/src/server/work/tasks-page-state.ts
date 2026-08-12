import { WebUuidSchema } from "../../platform/task-workspace-contracts";

type TasksPageQuery = Readonly<{
  item?: string;
  layout?: string;
  view?: string;
}>;

export function buildTasksPageState(locale: "ar" | "en", query: TasksPageQuery) {
  const layout = ["list", "board", "calendar"].includes(query.layout ?? "")
    ? (query.layout as "list" | "board" | "calendar")
    : "list";
  const view = query.view === "team" ? "team" : "my";
  const parsedItem = WebUuidSchema.safeParse(query.item);
  const selectedId = parsedItem.success ? parsedItem.data : null;
  const search = new URLSearchParams({ view, layout });
  if (selectedId !== null) search.set("item", selectedId);
  return {
    href: `/${locale}/tasks?${search.toString()}`,
    layout,
    selectedId,
    view,
  } as const;
}
