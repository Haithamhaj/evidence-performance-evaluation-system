export type MonthlyReadinessView = Readonly<{
  project: Readonly<{ id: string; name: string }>;
  month: string;
  state: "clear" | "attention";
  messageKey: "readiness.recordMayBeInsufficient";
  gaps: readonly Readonly<{
    kind:
      | "silent_active_scope"
      | "artifact_criterion_without_source"
      | "RESEARCH_QUESTION_MISSING"
      | "EXPERIMENT_METHOD_INCOMPLETE"
      | "RUN_INTERPRETATION_MISSING"
      | "EXPERIMENT_CONCLUSION_MISSING"
      | "RESEARCH_DECISION_MISSING"
      | "APPLIED_LEARNING_UNLINKED"
      | "EVIDENCE_ATTRIBUTION_UNRESOLVED";
    scopeId: string;
    scopeKind: "project" | "workstream";
    scopeName: string;
    correctiveAction:
      | "add_substantive_update"
      | "attach_source"
      | "RESEARCH_QUESTION_MISSING"
      | "EXPERIMENT_METHOD_INCOMPLETE"
      | "RUN_INTERPRETATION_MISSING"
      | "EXPERIMENT_CONCLUSION_MISSING"
      | "RESEARCH_DECISION_MISSING"
      | "APPLIED_LEARNING_UNLINKED"
      | "EVIDENCE_ATTRIBUTION_UNRESOLVED";
  }>[];
}>;

export function ReadinessView({
  catalog,
  locale,
  view,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  locale: import("@evaluation/localization").Locale;
  view: MonthlyReadinessView;
}>) {
  return (
    <section className="dailyWorkPage" aria-labelledby="monthly-readiness-heading">
      <nav className="breadcrumbs" aria-label={catalog["workspace.backToProjects"]}>
        <a href={`/${locale}/projects/${view.project.id}/daily-work`}>
          {catalog["workspace.backToProjects"]}
        </a>
      </nav>
      <header className="compactPageHeading">
        <div>
          <p className="eyebrow">{catalog["readiness.eyebrow"]}</p>
          <h1 id="monthly-readiness-heading">{catalog["readiness.title"]}</h1>
          <p>{view.project.name}</p>
        </div>
        <span className={`statusBadge status-${view.state}`}>
          {catalog[`readiness.state.${view.state}`]}
        </span>
      </header>
      <p className="boundaryNote">{catalog[view.messageKey]}</p>
      {view.gaps.length === 0 ? (
        <section className="panel emptyState">
          <h2>{catalog["readiness.clearTitle"]}</h2>
          <p>{catalog["readiness.clearBody"]}</p>
        </section>
      ) : (
        <section className="panel" aria-labelledby="readiness-actions-heading">
          <h2 id="readiness-actions-heading">{catalog["readiness.actionsTitle"]}</h2>
          <div className="compactActionList">
            {view.gaps.map((gap) => (
              <article className="compactActionRow" key={`${gap.kind}:${gap.scopeId}`}>
                <div>
                  <strong>{gap.scopeName}</strong>
                  <p>{catalog[`readiness.gap.${gap.kind}`]}</p>
                </div>
                <a className="secondaryLink" href={`/${locale}/my-work`}>
                  {catalog[`readiness.action.${gap.correctiveAction}`]}
                </a>
              </article>
            ))}
          </div>
        </section>
      )}
      <p className="boundaryNote">{catalog["readiness.notPerformance"]}</p>
    </section>
  );
}
