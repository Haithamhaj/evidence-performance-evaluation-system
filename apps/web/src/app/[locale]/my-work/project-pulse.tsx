export function ProjectPulse({
  catalog,
  items,
  locale,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  items: readonly import("@evaluation/contracts").ProjectPulseItem[];
  locale: import("@evaluation/localization").Locale;
}>) {
  return (
    <section className="compactQueue panel">
      <h2>{catalog["today.projectPulse"]}</h2>
      {items.length === 0 ? (
        <p className="emptyRow">{catalog["today.projectPulseEmpty"]}</p>
      ) : (
        <ul className="pulseList">
          {items.map((item) => (
            <li key={item.id}>
              <a href={`/${locale}/projects/${item.id}/daily-work`}>{item.name}</a>
              {item.progress.state === "accepted" ? (
                <span>{item.progress.percent}%</span>
              ) : (
                <span>{catalog[`today.progress.${item.progress.state}`]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="boundaryNote">{catalog["progress.notPerformance"]}</p>
    </section>
  );
}
