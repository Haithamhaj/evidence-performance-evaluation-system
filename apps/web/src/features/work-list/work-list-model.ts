export function buildWorkListModel<
  Item extends Readonly<{ id: string; projectId: string; status?: string; title: string }>,
>({
  items,
  projects,
  unknownProjectLabel,
}: Readonly<{
  items: readonly Item[];
  projects: readonly Readonly<{ id: string; name: string }>[];
  unknownProjectLabel: string;
}>) {
  const projectNames = new Map(projects.map(({ id, name }) => [id, name]));
  const decorate = (item: Item) => ({
    item,
    projectName: projectNames.get(item.projectId) ?? unknownProjectLabel,
  });
  return items.map(decorate);
}

export function buildWorkGroupModel<
  Item extends Readonly<{ id: string; projectId: string; status?: string; title: string }>,
>({
  items,
  projects,
  snapshot,
  unknownProjectLabel,
}: Readonly<{
  items: readonly Item[];
  projects: readonly Readonly<{ id: string; name: string }>[];
  snapshot: Readonly<{
    needsMyAction: readonly Item[];
    today: readonly Item[];
    overdue: readonly Item[];
    upcoming: readonly Item[];
  }>;
  unknownProjectLabel: string;
}>) {
  const projectNames = new Map(projects.map(({ id, name }) => [id, name]));
  const decorate = (item: Item) => ({
    item,
    projectName: projectNames.get(item.projectId) ?? unknownProjectLabel,
  });
  const used = new Set<string>();
  const take = (candidates: readonly Item[]) =>
    candidates.filter(({ id }) => !used.has(id) && used.add(id)).map(decorate);
  const blocked = items.filter(({ status }) => status === "blocked");
  const primary = [
    { key: "needs_my_action" as const, items: take(snapshot.needsMyAction), collapsed: false },
    { key: "today" as const, items: take(snapshot.today), collapsed: false },
    { key: "overdue" as const, items: take(snapshot.overdue), collapsed: false },
    { key: "waiting_blocked" as const, items: take(blocked), collapsed: true },
  ];
  const upcoming = take([...snapshot.upcoming, ...items]);
  return [...primary, { key: "upcoming" as const, items: upcoming, collapsed: true }];
}
