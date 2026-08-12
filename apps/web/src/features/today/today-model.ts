type Snapshot = import("@evaluation/contracts").DailyWorkspaceSnapshot;
type WorkItem = import("@evaluation/contracts").WorkItemDetail;

export type TodaySectionKey = "needs_my_action" | "today" | "overdue";

export type TodayItem = Readonly<{
  item: WorkItem;
  projectName: string | null;
}>;

export type TodayModel = Readonly<{
  clear: boolean;
  sections: readonly Readonly<{
    key: TodaySectionKey;
    items: readonly TodayItem[];
  }>[];
}>;

export function buildTodayModel(snapshot: Snapshot): TodayModel {
  const projectNames = new Map(snapshot.projectPulse.map((project) => [project.id, project.name]));
  const decorate = (items: readonly WorkItem[]) =>
    items.map((item) => ({ item, projectName: projectNames.get(item.projectId) ?? null }));
  const sections = [
    { key: "needs_my_action" as const, items: decorate(snapshot.needsMyAction) },
    { key: "today" as const, items: decorate(snapshot.today) },
    { key: "overdue" as const, items: decorate(snapshot.overdue) },
  ];
  return {
    clear: sections.every((section) => section.items.length === 0),
    sections,
  };
}
