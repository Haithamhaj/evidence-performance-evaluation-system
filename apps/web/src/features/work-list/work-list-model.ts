export function buildWorkListModel<
  Item extends Readonly<{ id: string; projectId: string; title: string }>,
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
  return items.map((item) => ({
    item,
    projectName: projectNames.get(item.projectId) ?? unknownProjectLabel,
  }));
}
